cmake_minimum_required(VERSION 3.20)
project(nam_a2_wasm_phase1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(NAM_CORE "${CMAKE_CURRENT_SOURCE_DIR}/third_party/NeuralAmpModelerCore")
file(GLOB NAM_SOURCES CONFIGURE_DEPENDS
  "${NAM_CORE}/NAM/*.cpp"
  "${NAM_CORE}/NAM/wavenet/*.cpp")

add_library(nam_core OBJECT ${NAM_SOURCES})
target_include_directories(nam_core PUBLIC
  "${NAM_CORE}"
  "${NAM_CORE}/NAM"
  "${NAM_CORE}/Dependencies/eigen"
  "${NAM_CORE}/Dependencies/nlohmann")
target_compile_definitions(nam_core PUBLIC NAM_SAMPLE_FLOAT NAM_ENABLE_A2_FAST)
target_compile_options(nam_core PRIVATE -O3)

add_library(nam_wrapper OBJECT src/nam-wasm/nam_wrapper.cpp)
target_include_directories(nam_wrapper PUBLIC src/nam-wasm)
target_link_libraries(nam_wrapper PUBLIC nam_core)

add_library(cabinet_wrapper OBJECT src/nam-wasm/cabinet_wrapper.cpp)
target_include_directories(cabinet_wrapper PUBLIC src/nam-wasm)
target_link_libraries(cabinet_wrapper PUBLIC nam_core)

add_executable(nam_native tools/nam_native.cpp
  $<TARGET_OBJECTS:nam_wrapper> $<TARGET_OBJECTS:nam_core>)
target_link_libraries(nam_native PRIVATE nam_wrapper nam_core)
if(NOT EMSCRIPTEN)
  add_executable(cabinet_native tools/cabinet_native.cpp
    $<TARGET_OBJECTS:cabinet_wrapper> $<TARGET_OBJECTS:nam_core>)
  target_link_libraries(cabinet_native PRIVATE cabinet_wrapper nam_core)
endif()

if(EMSCRIPTEN)
  target_compile_options(nam_core PRIVATE -fwasm-exceptions)
  target_compile_options(nam_wrapper PRIVATE -fwasm-exceptions)
  target_compile_options(cabinet_wrapper PRIVATE -fwasm-exceptions)
  target_compile_options(nam_native PRIVATE -fwasm-exceptions)
  target_link_options(nam_native PRIVATE -fwasm-exceptions)
  add_executable(nam_wasm src/nam-wasm/wasm_exports.cpp
    $<TARGET_OBJECTS:nam_wrapper> $<TARGET_OBJECTS:nam_core>)
  target_link_libraries(nam_wasm PRIVATE nam_wrapper nam_core)
  target_compile_options(nam_core PRIVATE -msimd128)
  target_compile_options(nam_wrapper PRIVATE -msimd128)
  target_compile_options(nam_wasm PRIVATE -msimd128 -fwasm-exceptions)
  set_target_properties(nam_wasm PROPERTIES
    OUTPUT_NAME "nam"
    SUFFIX ".js"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/dist")
  target_link_options(nam_wasm PRIVATE
    -O3 -msimd128 -fwasm-exceptions
    "-sEXPORTED_FUNCTIONS=['_malloc','_free','_nam_create','_nam_load_model','_nam_process','_nam_reset','_nam_destroy','_nam_input_buffer','_nam_output_buffer','_nam_expected_sample_rate','_nam_last_error']"
    "-sEXPORTED_RUNTIME_METHODS=['ccall','UTF8ToString']"
    -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createNamModule
    -sENVIRONMENT=node
    -sFILESYSTEM=0
    -sALLOW_MEMORY_GROWTH=1
    -sASSERTIONS=0)

  add_executable(nam_worklet src/nam-wasm/wasm_exports.cpp
    $<TARGET_OBJECTS:nam_wrapper> $<TARGET_OBJECTS:cabinet_wrapper> $<TARGET_OBJECTS:nam_core>)
  target_link_libraries(nam_worklet PRIVATE nam_wrapper nam_core)
  target_compile_options(nam_worklet PRIVATE -msimd128 -fwasm-exceptions)
  set_target_properties(nam_worklet PROPERTIES
    OUTPUT_NAME "nam-simd"
    SUFFIX ".wasm"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/dist")
  target_link_options(nam_worklet PRIVATE
    -O3 -msimd128 -fwasm-exceptions --no-entry
    -sSTANDALONE_WASM=1
    "-sEXPORTED_FUNCTIONS=['_malloc','_free','_nam_create','_nam_load_model','_nam_process','_nam_reset','_nam_destroy','_nam_input_buffer','_nam_output_buffer','_nam_expected_sample_rate','_nam_last_error','_cabinet_create','_cabinet_load_ir','_cabinet_process','_cabinet_reset','_cabinet_destroy','_cabinet_input_buffer','_cabinet_output_buffer','_cabinet_ir_length','_cabinet_last_error']"
    -sFILESYSTEM=0
    -sALLOW_MEMORY_GROWTH=1
    -sASSERTIONS=0)
endif()

enable_testing()
add_test(NAME native_smoke
  COMMAND nam_native smoke "${NAM_CORE}/example_models/A2.nam")
add_test(NAME invalid_model_rejected
  COMMAND nam_native smoke "${CMAKE_CURRENT_SOURCE_DIR}/tests/invalid.nam")
set_tests_properties(invalid_model_rejected PROPERTIES WILL_FAIL TRUE)
