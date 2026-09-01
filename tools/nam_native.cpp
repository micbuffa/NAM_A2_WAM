#include "nam_wrapper.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <random>
#include <string>
#include <vector>

static std::string read_file(const char* path) {
  std::ifstream stream(path, std::ios::binary);
  if (!stream) throw std::runtime_error(std::string("Cannot open ") + path);
  return {std::istreambuf_iterator<char>(stream), {}};
}

static std::vector<float> make_input(size_t size, double sample_rate = 48000.0) {
  std::vector<float> data(size);
  for (size_t i = 0; i < size; ++i)
    data[i] = 0.15f * std::sin(2.0 * 3.141592653589793 * 997.0 * static_cast<double>(i) / sample_rate);
  return data;
}

int main(int argc, char** argv) {
  if (argc < 3) { std::cerr << "usage: nam_native smoke|render|bench model.nam [output.f32]\n"; return 2; }
  try {
    const auto bytes = read_file(argv[2]);
    const double sample_rate = std::string(argv[1]) == "bench" && argc >= 4 ? std::stod(argv[3]) : 48000.0;
    std::unique_ptr<NamModel, decltype(&nam_destroy)> model(nam_create(sample_rate), nam_destroy);
    if (!model || !nam_load_model(model.get(), bytes.data(), bytes.size())) {
      std::cerr << nam_last_error(model.get()) << '\n'; return 1;
    }
    if (std::string(argv[1]) == "smoke") {
      auto input = make_input(128, sample_rate), output = input, first = input;
      if (!nam_process(model.get(), input.data(), output.data(), 128)) return 1;
      if (!std::all_of(output.begin(), output.end(), [](float x) { return std::isfinite(x); })) return 1;
      first = output;
      if (!nam_reset(model.get()) || !nam_process(model.get(), input.data(), output.data(), 128)) return 1;
      for (size_t i = 0; i < output.size(); ++i)
        if (std::abs(output[i] - first[i]) > 1e-7f) return 1;
      std::cout << "ok expected_sr=" << nam_expected_sample_rate(model.get()) << " first=" << output[0] << '\n';
      return 0;
    }
    if (std::string(argv[1]) == "render") {
      if (argc < 4) return 2;
      auto input = make_input(48000, sample_rate), output = input;
      for (size_t p = 0; p < input.size(); p += 128)
        nam_process(model.get(), input.data() + p, output.data() + p, 128);
      std::ofstream out(argv[3], std::ios::binary);
      out.write(reinterpret_cast<const char*>(output.data()), output.size() * sizeof(float));
      return out ? 0 : 1;
    }
    if (std::string(argv[1]) == "bench") {
      constexpr int iterations = 2000, warmup = 100;
      auto input = make_input(128, sample_rate), output = input;
      std::vector<double> us; us.reserve(iterations);
      for (int i = 0; i < iterations + warmup; ++i) {
        const auto begin = std::chrono::steady_clock::now();
        nam_process(model.get(), input.data(), output.data(), 128);
        const auto end = std::chrono::steady_clock::now();
        if (i >= warmup) us.push_back(std::chrono::duration<double, std::micro>(end - begin).count());
      }
      std::sort(us.begin(), us.end());
      const double avg = std::accumulate(us.begin(), us.end(), 0.0) / us.size();
      const double deadline = 128.0e6 / sample_rate;
      std::cout << std::fixed << std::setprecision(2) << "sr=" << sample_rate << " avg_us=" << avg
                << " p95_us=" << us[static_cast<size_t>(us.size() * .95)]
                << " max_us=" << us.back() << " deadline_us=" << deadline << " margin=" << deadline / avg << "x\n";
      return 0;
    }
    return 2;
  } catch (const std::exception& e) { std::cerr << e.what() << '\n'; return 1; }
}
