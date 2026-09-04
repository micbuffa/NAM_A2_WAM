#include "nam_wrapper.h"

#include <algorithm>
#include <cmath>
#include <memory>
#include <string>

#include "NAM/dsp.h"
#include "NAM/get_dsp.h"
#include "NAM/slimmable.h"
#include "NAM/wavenet/a2_fast.h"
#include "json.hpp"

namespace {
constexpr int kQuantum = 128;

bool is_a2_model(const nlohmann::json& model) {
  const auto architecture = model.value("architecture", std::string{});
  if (architecture == "WaveNet") {
    int channels = 0;
    return nam::wavenet::a2_fast::is_a2_shape(model.at("config"), &channels);
  }
  if (architecture == "SlimmableContainer") {
    const auto& submodels = model.at("config").at("submodels");
    return !submodels.empty() && std::all_of(submodels.begin(), submodels.end(),
      [](const auto& entry) { return is_a2_model(entry.at("model")); });
  }
  return false;
}
}

struct NamModel {
  explicit NamModel(double rate) : sample_rate(rate) {}
  double sample_rate;
  double expected_sample_rate = -1.0;
  std::unique_ptr<nam::DSP> dsp;
  alignas(16) float input[kQuantum]{};
  alignas(16) float output[kQuantum]{};
  std::string error;
};

extern "C" NamModel* nam_create(double sample_rate) {
  if (!(sample_rate > 0.0) || !std::isfinite(sample_rate)) return nullptr;
  try { return new NamModel(sample_rate); } catch (...) { return nullptr; }
}

extern "C" int nam_load_model(NamModel* model, const char* data, size_t length) {
  if (!model || !data || length == 0) return 0;
  try {
    const auto json = nlohmann::json::parse(data, data + length);
    if (!is_a2_model(json)) throw std::runtime_error("Model is not a supported A2 model");
    nam::DspLoadOptions options;
    options.prewarm = false;
    auto candidate = nam::get_dsp(json, options);
    if (!candidate || candidate->NumInputChannels() != 1 || candidate->NumOutputChannels() != 1)
      throw std::runtime_error("A2 model must be mono");
    candidate->Reset(model->sample_rate, kQuantum);
    model->expected_sample_rate = candidate->GetExpectedSampleRate();
    model->dsp = std::move(candidate);
    model->error.clear();
    return 1;
  } catch (const std::exception& e) {
    model->error = e.what();
  } catch (...) {
    model->error = "Unknown model loading error";
  }
  return 0;
}

extern "C" int nam_set_slimmable_size(NamModel* model, double size) {
  if (!model || !model->dsp || !std::isfinite(size)) return 0;
  try {
    auto* slimmable = dynamic_cast<nam::SlimmableModel*>(model->dsp.get());
    if (!slimmable) return 0;
    slimmable->SetSlimmableSize(std::clamp(size, 0.0, 1.0));
    model->error.clear();
    return 1;
  } catch (const std::exception& e) {
    model->error = e.what();
  } catch (...) {
    model->error = "Unknown slimmable model selection error";
  }
  return 0;
}

extern "C" int nam_process(NamModel* model, const float* input, float* output, int num_samples) {
  if (!model || !model->dsp || !input || !output || num_samples < 0 || num_samples > kQuantum) return 0;
  float* inputs[] = {const_cast<float*>(input)};
  float* outputs[] = {output};
  model->dsp->process(inputs, outputs, num_samples);
  return 1;
}

extern "C" int nam_reset(NamModel* model) {
  if (!model || !model->dsp) return 0;
  try {
    model->dsp->Reset(model->sample_rate, kQuantum);
    model->error.clear();
    return 1;
  } catch (const std::exception& e) { model->error = e.what(); return 0; }
}

extern "C" void nam_destroy(NamModel* model) { delete model; }
extern "C" float* nam_input_buffer(NamModel* model) { return model ? model->input : nullptr; }
extern "C" float* nam_output_buffer(NamModel* model) { return model ? model->output : nullptr; }
extern "C" double nam_expected_sample_rate(const NamModel* model) { return model ? model->expected_sample_rate : -1.0; }
extern "C" const char* nam_last_error(const NamModel* model) { return model ? model->error.c_str() : "Invalid handle"; }
