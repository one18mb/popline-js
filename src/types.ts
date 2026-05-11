export type PlnValue = null | boolean | number | string | PlnObject | PlnArray;

export interface PlnObject { [key: string]: PlnValue }
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PlnArray extends Array<PlnValue> {}

export class PlnError extends Error {
  constructor(msg: string) { super(msg); this.name = 'PlnError'; }
}
