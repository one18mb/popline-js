import { PlnValue, PlnError } from './types';

/* ─── Pop suffix helpers ─── */

function trimPopSuffix(content: string): {value: string, pop: number} {
  if (content.length < 2) return {value: content, pop: 0};
  let i = content.length - 1;
  if (content[i] < '0' || content[i] > '9') return {value: content, pop: 0};
  while (i > 0 && content[i - 1] >= '0' && content[i - 1] <= '9') i--;
  if (i === 0 || content[i - 1] !== ' ') return {value: content, pop: 0};
  const val = content.slice(0, i - 1);
  if (val.length === 0) return {value: content, pop: 0};
  return {value: val, pop: parseInt(content.slice(i), 10)};
}

function popSuffixAfter(s: string): number {
  if (s.length === 0) return 0;
  if (s[0] !== ' ') return -1;
  if (s.length < 2 || s[1] < '0' || s[1] > '9') return -1;
  let n = 0;
  for (let i = 1; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return -1;
    n = n * 10 + (c - 48);
  }
  return n;
}

function isKeyValid(key: string): boolean {
  const len = key.length;
  if (len === 0) return false;
  for (let i = 0; i < len; i++) {
    const c = key.charCodeAt(i);
    if (c === 58 || c === 34 || c === 123 || c === 91 || c === 32 || c === 9) return false;
  }
  return true;
}

function parseQuoted(content: string): string {
  let parts: string[] = [];
  let pos = 0;
  let i = 0;
  while (i < content.length) {
    if (content[i] === '"') {
      if (i + 1 < content.length && content[i + 1] === '"') {
        parts.push(content.slice(pos, i + 1));
        pos = i + 2;
        i += 2;
      } else {
        parts.push(content.slice(pos, i));
        const after = content.slice(i + 1);
        if (after.trim().length > 0) throw new PlnError('trailing content after quote');
        return parts.join('');
      }
    } else { i++; }
  }
  throw new PlnError('multi-line strings not supported');
}

function parseScalar(s: string): any {
  if (s.startsWith('"')) return parseQuoted(s.slice(1));
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  const first = s.charCodeAt(0);
  if (first === 45 || (first >= 48 && first <= 57)) {
    const n = Number(s);
    if (!isNaN(n)) return n;
  }
  throw new PlnError(`bare string must be quoted: ${s}`);
}

function handleStringLine(line: string): {value: string, pop: number} | undefined {
  const parts: string[] = [];
  let pos = 0, i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      if (i + 1 < line.length && line[i + 1] === '"') {
        parts.push(line.slice(pos, i + 1));
        pos = i + 2;
        i += 2;
      } else {
        parts.push(line.slice(pos, i));
        const after = line.slice(i + 1);
        if (after.length > 0) {
          const nPop = popSuffixAfter(after);
          if (nPop < 0) throw new PlnError('trailing content after quote');
          return {value: parts.join(''), pop: nPop};
        }
        return {value: parts.join(''), pop: 0};
      }
    } else { i++; }
  }
  return undefined;
}

function parseInlineContainers(
  s: string, frames: PlnValue[], stack: Array<'object' | 'array' | 'scalar'>, currentKey: string | null
): void {
  let part = s.trimStart();
  while (part.length > 0) {
    const ch = part[0];
    if (ch !== '{' && ch !== '[') throw new PlnError('inline containers must be { or [');
    if (ch === '{') {
      const obj: PlnValue = {} as any;
      if (frames.length === 0) { frames.push(obj); stack.push('object'); }
      else {
        const top = frames[frames.length - 1];
        if (stack[stack.length - 1] === 'object') { (top as any)[currentKey || ''] = obj; }
        else { (top as any[]).push(obj); }
        frames.push(obj); stack.push('object');
      }
    } else {
      const arr: PlnValue = [] as any;
      if (frames.length === 0) { frames.push(arr); stack.push('array'); }
      else {
        const top = frames[frames.length - 1];
        if (stack[stack.length - 1] === 'object') { (top as any)[currentKey || ''] = arr; }
        else { (top as any[]).push(arr); }
        frames.push(arr); stack.push('array');
      }
    }
    part = part.slice(1).trimStart();
  }
}

export function parse(text: string): any {
  const frames: PlnValue[] = [];
  const stack: Array<'object' | 'array' | 'scalar'> = [];
  let inString = false;
  let strbuf = '';
  let currentKey: string | null = null;

  /* Index-based line iteration */
  let lineStart = 0;
  const len = text.length;

  while (lineStart < len) {
    let nl = lineStart;
    while (nl < len && text[nl] !== '\n') nl++;
    let line = text.slice(lineStart, nl);
    lineStart = nl + 1;

    /* Strip trailing \r */
    const lineLen = line.length;
    if (lineLen > 0 && line.charCodeAt(lineLen - 1) === 13) line = line.slice(0, -1);

    if (inString) {
      const result = handleStringLine(line);
      if (result !== undefined) {
        inString = false;
        const top = frames[frames.length - 1];
        if (stack[stack.length - 1] === 'object') { (top as any)[currentKey!] = result.value; }
        else { (top as any[]).push(result.value); }
        if (result.pop >= frames.length) {
          result.pop = frames.length - 1;
        }
        for (let p = 0; p < result.pop; p++) { frames.pop(); stack.pop(); }
        strbuf = '';
      }
      
      continue;
    }

    if (line.length === 0) {
      if (frames.length > 0) throw new PlnError('empty line not allowed in message body');
      
      continue;
    }

    /* pop prefix — only for containers and key:value lines */
    let nPop = 0;
    let valueStart = 0;
    let pi = 0;
    while (pi < line.length && line.charCodeAt(pi) >= 48 && line.charCodeAt(pi) <= 57) pi++;
    if (pi > 0 && pi < line.length && line[pi] === ' ') {
      const nc = pi + 1 < line.length ? line.charCodeAt(pi + 1) : 0;
      if (nc === 123 || nc === 91) {
        nPop = parseInt(line.slice(0, pi), 10);
        valueStart = pi + 1;
      } else {
        /* Check if it looks like k: v (has ':') */
        for (let si = pi + 1; si < line.length; si++) {
          if (line[si] === ':') { nPop = parseInt(line.slice(0, pi), 10); valueStart = pi + 1; break; }
        }
      }
    }
    if (nPop >= frames.length) nPop = frames.length - 1;
    for (let p = 0; p < nPop; p++) { frames.pop(); stack.pop(); }

    const rest = valueStart === 0 ? line : line.slice(valueStart);
    if (rest.length === 0) throw new PlnError('bare pop line');

    if (frames.length === 0) {
      if (rest.length > 1 && rest.charCodeAt(0) === 91) {
        let trimmed = 1;
        while (trimmed < rest.length && (rest[trimmed] === ' ' || rest[trimmed] === '\t')) trimmed++;
        if (trimmed < rest.length && (rest.charCodeAt(trimmed) === 91 || rest.charCodeAt(trimmed) === 123)) {
          parseInlineContainers(rest, frames, stack, null);
          continue;
        }
      }
      if (rest === '{') { frames.push({} as any); stack.push('object'); continue; }
      if (rest === '[') { frames.push([] as any); stack.push('array'); continue; }
      frames.push(parseScalar(rest));
      stack.push('scalar');
      break;
    }

    const top = frames[frames.length - 1];
    const topType = stack[stack.length - 1];

    if (topType === 'object') {
      const sep = rest.indexOf(': ');
      if (sep < 0) throw new PlnError(`object line must be 'key: value': ${rest}`);
      const key = rest.slice(0, sep);
      if (!isKeyValid(key)) throw new PlnError(`invalid key: ${key}`);
      const valPartRaw = rest.slice(sep + 2);
      currentKey = key;

      let valPart = valPartRaw;
      let valSuffixPop = 0;
      if (valPart.charCodeAt(0) !== 123 && valPart.charCodeAt(0) !== 91) {
        const r = trimPopSuffix(valPart);
        valPart = r.value; valSuffixPop = r.pop;
      }

      if (valPart.charCodeAt(0) === 123 && valPart.length === 1) {
        const obj: any = {}; (top as any)[key] = obj; frames.push(obj); stack.push('object');
      } else if (valPart.charCodeAt(0) === 91 && valPart.length === 1) {
        const arr: any[] = []; (top as any)[key] = arr; frames.push(arr); stack.push('array');
      } else if (valPart.length > 0) {
        (top as any)[key] = parseScalar(valPart);
      }

      if (valSuffixPop >= frames.length) valSuffixPop = frames.length - 1;
      for (let p = 0; p < valSuffixPop; p++) { frames.pop(); stack.pop(); }
    } else {
      let arrVal = rest;
      let arrSuffixPop = 0;
      if (arrVal.charCodeAt(0) !== 123 && arrVal.charCodeAt(0) !== 91) {
        const r = trimPopSuffix(arrVal);
        arrVal = r.value; arrSuffixPop = r.pop;
      }

      if (arrVal.charCodeAt(0) === 123 && arrVal.length === 1) {
        const obj: any = {}; (top as any[]).push(obj); frames.push(obj); stack.push('object');
      } else if (arrVal.charCodeAt(0) === 91 && arrVal.length === 1) {
        const arr: any[] = []; (top as any[]).push(arr); frames.push(arr); stack.push('array');
      } else if (arrVal.length > 0) {
        (top as any[]).push(parseScalar(arrVal));
      }

      if (arrSuffixPop >= frames.length) arrSuffixPop = frames.length - 1;
      for (let p = 0; p < arrSuffixPop; p++) { frames.pop(); stack.pop(); }
    }

    
  }

  return frames.length > 0 ? frames[0] : null;
}
