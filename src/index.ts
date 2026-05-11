import { parse as _parse } from './parser';
import { serialize as _serialize } from './serializer';

export const Pln = {
  parse: _parse,
  stringify: _serialize,
};

export type { PlnValue, PlnObject, PlnArray } from './types';
export { PlnError } from './types';
