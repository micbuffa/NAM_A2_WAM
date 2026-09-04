#pragma once

#include <cstddef>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct NamModel NamModel;

NamModel* nam_create(double sample_rate);
int nam_load_model(NamModel* model, const char* data, size_t length);
int nam_set_slimmable_size(NamModel* model, double size);
int nam_process(NamModel* model, const float* input, float* output, int num_samples);
int nam_reset(NamModel* model);
void nam_destroy(NamModel* model);
float* nam_input_buffer(NamModel* model);
float* nam_output_buffer(NamModel* model);
double nam_expected_sample_rate(const NamModel* model);
const char* nam_last_error(const NamModel* model);

#ifdef __cplusplus
}
#endif
