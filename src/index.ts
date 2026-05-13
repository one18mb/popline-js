import { parse as tsParse } from './parser';
import { serialize as tsSerialize } from './serializer';
import { PlnError } from './types';
import * as wasm from './wasm';

// Auto-init WASM in background
wasm.init().catch(() => {});

export const Pln = {
  parse(input: string): any {
    if (wasm.isReady()) return wasm.parse(input);
    return tsParse(input);
  },
  stringify(value: any): string {
    if (wasm.isReady()) return wasm.stringify(value);
    return tsSerialize(value);
  },
  async initWasm(): Promise<void> { return wasm.init(); },
  get wasmReady(): boolean { return wasm.isReady(); },
};

export type { PlnValue, PlnObject, PlnArray } from './types';
export { PlnError } from './types';
