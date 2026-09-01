#include "nam_wrapper.h"

// The C API is linked into this executable; this translation unit deliberately
// keeps the Emscripten boundary free of embind and C++ object exposure.
int main() { return 0; }

