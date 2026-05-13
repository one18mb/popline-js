/* Direct PopLine DOM ↔ JSON — no intermediate cJSON tree */
#include "popline.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <errno.h>

/* ─── String builder ─────────────────────────────────────── */

typedef struct { char *buf; int len, cap; } jsb_t;

static void jsb_ensure(jsb_t *b, int n) {
    if (b->len + n + 1 <= b->cap) return;
    b->cap = b->cap ? b->cap * 2 : 1024;
    while (b->len + n + 1 > b->cap) b->cap *= 2;
    b->buf = (char *)realloc(b->buf, b->cap);
}

static void jsb_putc(jsb_t *b, char c) { jsb_ensure(b, 1); b->buf[b->len++] = c; b->buf[b->len] = 0; }
static void jsb_puts(jsb_t *b, const char *s) { int n = (int)strlen(s); jsb_ensure(b, n); memcpy(b->buf + b->len, s, n); b->len += n; b->buf[b->len] = 0; }

/* ─── Direct JSON serializer (PopLine DOM → JSON string) ── */

static void json_write_value(jsb_t *b, pln_value_t *v) {
    if (!v) { jsb_puts(b, "null"); return; }
    switch (v->type) {
    case PLN_NULL:  jsb_puts(b, "null"); break;
    case PLN_BOOL:  jsb_puts(b, v->data.bool_val ? "true" : "false"); break;
    case PLN_INT: { char tmp[32]; int n = snprintf(tmp, sizeof tmp, "%lld", v->data.int_val); jsb_ensure(b, n); memcpy(b->buf + b->len, tmp, n); b->len += n; b->buf[b->len] = 0; break; }
    case PLN_FLOAT:{ char tmp[64]; int n = snprintf(tmp, sizeof tmp, "%.15g", v->data.float_val); jsb_ensure(b, n); memcpy(b->buf + b->len, tmp, n); b->len += n; b->buf[b->len] = 0; break; }
    case PLN_STRING: {
        jsb_putc(b, '"');
        if (v->data.string_val) {
            for (char *p = v->data.string_val; *p; p++) {
                if (*p == '"') jsb_puts(b, "\\\"");
                else if (*p == '\\') jsb_puts(b, "\\\\");
                else if (*p == '\n') jsb_puts(b, "\\n");
                else if (*p == '\t') jsb_puts(b, "\\t");
                else if (*p < 0x20) { char esc[7]; snprintf(esc, 7, "\\u%04x", (unsigned char)*p); jsb_puts(b, esc); }
                else jsb_putc(b, *p);
            }
        }
        jsb_putc(b, '"');
        break;
    }
    case PLN_OBJECT: {
        jsb_putc(b, '{');
        int first = 1;
        for (pln_value_t *c = v->child; c; c = c->next) {
            if (!first) jsb_putc(b, ',');
            first = 0;
            jsb_putc(b, '"');
            if (c->key) { for (char *p = c->key; *p; p++) { if (*p == '"') jsb_puts(b, "\\\""); else jsb_putc(b, *p); } }
            jsb_puts(b, "\":");
            json_write_value(b, c);
        }
        jsb_putc(b, '}');
        break;
    }
    case PLN_ARRAY: {
        jsb_putc(b, '[');
        int first = 1;
        for (pln_value_t *c = v->child; c; c = c->next) {
            if (!first) jsb_putc(b, ',');
            first = 0;
            json_write_value(b, c);
        }
        jsb_putc(b, ']');
        break;
    }
    }
}

/* ─── Minimal JSON parser (JSON string → PopLine DOM) ─── */

typedef struct { const char *s; int pos, len; char err[64]; } jctx_t;

static void jskip(jctx_t *j) { while (j->pos < j->len && (j->s[j->pos] == ' ' || j->s[j->pos] == '\t' || j->s[j->pos] == '\n' || j->s[j->pos] == '\r')) j->pos++; }
static int jpeek(jctx_t *j) { jskip(j); return j->pos < j->len ? j->s[j->pos] : EOF; }
static int jgetc(jctx_t *j) { int c = jpeek(j); if (c != EOF) j->pos++; return c; }
static int jmatch(jctx_t *j, const char *s) { jskip(j); int n = (int)strlen(s); if (j->pos + n > j->len) return 0; if (memcmp(j->s + j->pos, s, n) == 0) { j->pos += n; return 1; } return 0; }

static char *jparse_string(jctx_t *j) {
    if (jgetc(j) != '"') return NULL;
    int cap = 128, len = 0;
    char *buf = (char *)malloc(cap);
    while (j->pos < j->len) {
        char c = j->s[j->pos++];
        if (c == '"') break;
        if (c == '\\') {
            if (j->pos >= j->len) { free(buf); return NULL; }
            switch (j->s[j->pos++]) {
                case '"': buf[len++] = '"'; break; case '\\': buf[len++] = '\\'; break;
                case '/': buf[len++] = '/'; break; case 'n': buf[len++] = '\n'; break;
                case 't': buf[len++] = '\t'; break; case 'r': buf[len++] = '\r'; break;
                case 'b': buf[len++] = '\b'; break; case 'f': buf[len++] = '\f'; break;
                case 'u': { unsigned int u = 0; for (int i = 0; i < 4; i++) { c = j->s[j->pos++]; u <<= 4; if (c >= '0' && c <= '9') u |= c - '0'; else if (c >= 'a' && c <= 'f') u |= c - 'a' + 10; else if (c >= 'A' && c <= 'F') u |= c - 'A' + 10; } if (u < 0x80) buf[len++] = u; else if (u < 0x800) { buf[len++] = 0xC0 | (u >> 6); buf[len++] = 0x80 | (u & 0x3F); } else { buf[len++] = 0xE0 | (u >> 12); buf[len++] = 0x80 | ((u >> 6) & 0x3F); buf[len++] = 0x80 | (u & 0x3F); } break; }
                default: buf[len++] = '\\'; buf[len++] = j->s[j->pos - 1]; break;
            }
        } else buf[len++] = c;
        if (len >= cap - 4) { cap *= 2; buf = (char *)realloc(buf, cap); }
    }
    buf[len] = '\0';
    return buf;
}

static pln_value_t *jparse_value(jctx_t *j);

static pln_value_t *jparse_object(jctx_t *j) {
    jgetc(j); /* skip { */
    pln_value_t *obj = pln_value_new_object();
    if (jpeek(j) == '}') { jgetc(j); return obj; }
    while (1) {
        char *key = jparse_string(j);
        if (!key) { pln_value_free(obj); return NULL; }
        if (jgetc(j) != ':') { free(key); pln_value_free(obj); return NULL; }
        pln_value_t *val = jparse_value(j);
        if (!val) { free(key); pln_value_free(obj); return NULL; }
        pln_value_add_to_object(obj, key, val);
        free(key);
        if (jpeek(j) == '}') { jgetc(j); break; }
        if (jgetc(j) != ',') { pln_value_free(obj); return NULL; }
    }
    return obj;
}

static pln_value_t *jparse_array(jctx_t *j) {
    jgetc(j); /* skip [ */
    pln_value_t *arr = pln_value_new_array();
    if (jpeek(j) == ']') { jgetc(j); return arr; }
    while (1) {
        pln_value_t *v = jparse_value(j);
        if (!v) { pln_value_free(arr); return NULL; }
        pln_value_add_to_array(arr, v);
        if (jpeek(j) == ']') { jgetc(j); break; }
        if (jgetc(j) != ',') { pln_value_free(arr); return NULL; }
    }
    return arr;
}

static pln_value_t *jparse_value(jctx_t *j) {
    int c = jpeek(j);
    if (c == '{') return jparse_object(j);
    if (c == '[') return jparse_array(j);
    if (c == '"') {
        char *s = jparse_string(j);
        pln_value_t *v = s ? pln_value_new_string(s) : NULL;
        free(s); return v;
    }
    if (jmatch(j, "true")) return pln_value_new_bool(1);
    if (jmatch(j, "false")) return pln_value_new_bool(0);
    if (jmatch(j, "null")) return pln_value_new_null();
    if (c == '-' || (c >= '0' && c <= '9')) {
        int start = j->pos;
        if (c == '-') j->pos++;
        while (j->pos < j->len && ((j->s[j->pos] >= '0' && j->s[j->pos] <= '9') || j->s[j->pos] == '.' || j->s[j->pos] == 'e' || j->s[j->pos] == 'E' || j->s[j->pos] == '+' || j->s[j->pos] == '-')) j->pos++;
        char tmp[128]; int nlen = j->pos - start;
        if (nlen >= (int)sizeof(tmp)) return NULL;
        memcpy(tmp, j->s + start, nlen); tmp[nlen] = '\0';
        int is_float = 0;
        for (int i = 0; i < nlen; i++) if (tmp[i] == '.' || tmp[i] == 'e' || tmp[i] == 'E') { is_float = 1; break; }
        char *end; errno = 0;
        if (is_float) { double d = strtod(tmp, &end); if (*end == 0 && errno != ERANGE) return pln_value_new_float(d); }
        else { long long ll = strtoll(tmp, &end, 10); if (*end == 0 && errno != ERANGE) return pln_value_new_int(ll); }
    }
    snprintf(j->err, sizeof j->err, "unexpected '%c'", c);
    return NULL;
}

/* ─── Public API ─────────────────────────────────────────── */

char *direct_json_dumps(pln_value_t *v) {
    if (!v) return NULL;
    jsb_t b = {0};
    json_write_value(&b, v);
    return b.buf;
}

pln_value_t *direct_json_parse(const char *json) {
    jctx_t j = {json, 0, (int)strlen(json), ""};
    pln_value_t *v = jparse_value(&j);
    if (!v) return NULL;
    if (jpeek(&j) != EOF) { pln_value_free(v); return NULL; }
    return v;
}
