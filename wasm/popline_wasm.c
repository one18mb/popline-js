/* popline_wasm.c — WASM entry point: string-in/string-out wrappers */
#include <stdlib.h>
#include <string.h>
#include <emscripten.h>
#include "popline.h"

/* Direct JSON conversion — no cJSON intermediate tree */
char *direct_json_dumps(pln_value_t *v);
pln_value_t *direct_json_parse(const char *json);

/* PopLine 文本 → JSON 字符串 */
EMSCRIPTEN_KEEPALIVE
char *pln_wasm_loads(const char *text) {
    pln_value_t *v = pln_loads(text);
    if (!v) return NULL;
    char *json = direct_json_dumps(v);
    pln_value_free(v);
    return json;
}

/* JSON 字符串 → PopLine 文本 */
EMSCRIPTEN_KEEPALIVE
char *pln_wasm_dumps(const char *json) {
    pln_value_t *v = direct_json_parse(json);
    if (!v) return NULL;
    char *pln = pln_dumps(v);
    pln_value_free(v);
    return pln;
}

EMSCRIPTEN_KEEPALIVE
void pln_wasm_free(char *p) {
    free(p);
}
