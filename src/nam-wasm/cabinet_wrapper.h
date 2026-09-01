#pragma once
#include <cstddef>
struct CabinetConvolver;
extern "C" {
CabinetConvolver* cabinet_create(double sample_rate);
int cabinet_load_ir(CabinetConvolver*, const float* samples, size_t length);
int cabinet_process(CabinetConvolver*, const float* input, float* output, int frames);
int cabinet_reset(CabinetConvolver*);
void cabinet_destroy(CabinetConvolver*);
float* cabinet_input_buffer(CabinetConvolver*);
float* cabinet_output_buffer(CabinetConvolver*);
size_t cabinet_ir_length(const CabinetConvolver*);
const char* cabinet_last_error(const CabinetConvolver*);
}
