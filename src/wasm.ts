/* WASM PopLine — Node.js + Web dual environment */
import { PlnError } from './types';

declare function require(name: string): any;

type WasmApi = { loads(s: string): string; dumps(s: string): string };
let wasm: WasmApi | null = null;
let initPromise: Promise<void> | null = null;

export function isReady(): boolean { return wasm !== null; }

export async function init(): Promise<void> {
  if (wasm) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const isNode = typeof process === 'object' && process.versions && process.versions.node;

    try {
      let mod: any;

      if (isNode) {
        // Node.js: pre-load binary, then require CJS module
        const fs = require('fs') as typeof import('fs');
        const path = require('path') as typeof import('path');
        const wasmBinary = fs.readFileSync(path.join(__dirname, '..', 'wasm', 'popline_wasm.wasm'));
        (globalThis as any).Module = { wasmBinary };
        mod = require('../wasm/popline_wasm');
      } else {
        // Web: emscripten loads .wasm via fetch automatically
        // @ts-ignore — CJS module loaded dynamically
        mod = await import('../wasm/popline_wasm');
      }

      const loads = mod.cwrap('pln_wasm_loads', 'string', ['string']);
      const dumps = mod.cwrap('pln_wasm_dumps', 'string', ['string']);
      wasm = { loads, dumps };
    } catch (e) {
      initPromise = null;
      throw e;
    }
  })();

  return initPromise;
}

export function parse(text: string): any {
  if (!wasm) throw new PlnError('WASM not initialized. Call await init() first.');
  return JSON.parse(wasm.loads(text));
}

export function stringify(value: any): string {
  if (!wasm) throw new PlnError('WASM not initialized. Call await init() first.');
  return wasm.dumps(JSON.stringify(value));
}
