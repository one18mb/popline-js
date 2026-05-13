import { parse as tsParse } from './parser';
import { serialize as tsSerialize } from './serializer';

export const Pln = {
  parse(input: string): any { return tsParse(input); },
  stringify(value: any): string { return tsSerialize(value); },
};

export type { PlnValue, PlnObject, PlnArray } from './types';
export { PlnError } from './types';
