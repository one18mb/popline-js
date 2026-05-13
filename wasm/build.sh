#!/bin/bash
set -e
cd "$(dirname "$0")"
emcc -O2 -I. popline_wasm.c popline.c popline_parser.c popline_json_direct.c \
  -o popline_wasm.js \
  -s EXPORTED_FUNCTIONS='["_pln_wasm_loads","_pln_wasm_dumps","_pln_wasm_free","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["cwrap","UTF8ToString","stringToUTF8","lengthBytesUTF8"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s WASM_ASYNC_COMPILATION=0 \
  -s ENVIRONMENT=node,web \
  -Wno-implicit-function-declaration
echo "WASM built: $(wc -c < popline_wasm.wasm) bytes"
