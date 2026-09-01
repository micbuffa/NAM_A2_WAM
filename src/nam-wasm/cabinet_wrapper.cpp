#include "cabinet_wrapper.h"
#include <algorithm>
#include <cmath>
#include <memory>
#include <string>
#include <vector>
#include "NAM/linear.h"

namespace { constexpr int kQuantum = 128; }
struct CabinetConvolver {
  explicit CabinetConvolver(double rate) : sample_rate(rate) {}
  double sample_rate;
  size_t length = 0;
  std::unique_ptr<nam::Linear> dsp;
  alignas(16) float input[kQuantum]{};
  alignas(16) float output[kQuantum]{};
  std::string error;
};
extern "C" CabinetConvolver* cabinet_create(double rate) {
  if (!(rate > 0) || !std::isfinite(rate)) return nullptr;
  try { return new CabinetConvolver(rate); } catch (...) { return nullptr; }
}
extern "C" int cabinet_load_ir(CabinetConvolver* c, const float* samples, size_t length) {
  if (!c || !samples || !length) return 0;
  try {
    std::vector<float> weights(samples, samples + length);
    auto candidate = std::make_unique<nam::Linear>(1, 1, (int)length, false, weights, c->sample_rate,
      nam::LinearImplementation::FFT);
    candidate->Reset(c->sample_rate, kQuantum);
    c->dsp = std::move(candidate); c->length = length; c->error.clear(); return 1;
  } catch (const std::exception& e) { c->error = e.what(); return 0; }
}
extern "C" int cabinet_process(CabinetConvolver* c, const float* input, float* output, int frames) {
  if (!c || !c->dsp || !input || !output || frames < 0 || frames > kQuantum) return 0;
  float* ins[]{const_cast<float*>(input)}; float* outs[]{output}; c->dsp->process(ins, outs, frames); return 1;
}
extern "C" int cabinet_reset(CabinetConvolver* c) { if (!c || !c->dsp) return 0; try { c->dsp->Reset(c->sample_rate,kQuantum); return 1; } catch (...) { return 0; } }
extern "C" void cabinet_destroy(CabinetConvolver* c) { delete c; }
extern "C" float* cabinet_input_buffer(CabinetConvolver* c) { return c ? c->input : nullptr; }
extern "C" float* cabinet_output_buffer(CabinetConvolver* c) { return c ? c->output : nullptr; }
extern "C" size_t cabinet_ir_length(const CabinetConvolver* c) { return c ? c->length : 0; }
extern "C" const char* cabinet_last_error(const CabinetConvolver* c) { return c ? c->error.c_str() : "Invalid handle"; }
