import { PlnError } from './types';

/* ─── Pop suffix helpers ─── */

/** Forward-scan for " N" pop suffix: when space found, check if rest is all digits */
function trimPopSuffix(content: string): {value: string, pop: number} {
  let inString = false;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '"') inString = !inString;
    if (!inString && content[i] === ' ') {
      let allDigits = true;
      for (let j = i + 1; j < content.length; j++) {
        if (content[j] < '0' || content[j] > '9') { allDigits = false; break; }
      }
      if (allDigits && i + 1 < content.length) {
        return {value: content.slice(0, i), pop: parseInt(content.slice(i + 1), 10)};
      }
    }
  }
  return {value: content, pop: 0};
}

/** Validate content after a closing `"` for multi-line string pop suffix.
 *  Returns -1 for invalid content, 0 for empty (no pop), or N for valid " N" suffix. */
function popSuffixAfter(s: string): number {
  if (s.length === 0) return 0;
  if (s[0] !== ' ') return -1;
  if (s.length < 2 || s[1] < '0' || s[1] > '9') return -1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] < '0' || s[i] > '9') return -1;
  }
  return parseInt(s.slice(1), 10);
}

function parseInlineContainers(
  s: string,
  frames: Array<Record<string, unknown> | unknown[]>,
  stack: Array<'object' | 'array'>,
  currentKey: string | null,
): void {
  let part = s.trimStart();
  while (part.length > 0) {
    const ch = part[0];
    if (ch !== '{' && ch !== '[') throw new PlnError('inline containers must be { or [');
    if (ch === '{') {
      const obj: Record<string, unknown> = {};
      if (frames.length === 0) {
        frames.push(obj); stack.push('object');
      } else {
        const top = frames[frames.length - 1];
        if (stack[stack.length - 1] === 'object') {
          (top as Record<string, unknown>)[currentKey || ''] = obj;
        } else {
          (top as unknown[]).push(obj);
        }
        frames.push(obj); stack.push('object');
      }
    } else {
      const arr: unknown[] = [];
      if (frames.length === 0) {
        frames.push(arr); stack.push('array');
      } else {
        const top = frames[frames.length - 1];
        if (stack[stack.length - 1] === 'object') {
          (top as Record<string, unknown>)[currentKey || ''] = arr;
        } else {
          (top as unknown[]).push(arr);
        }
        frames.push(arr); stack.push('array');
      }
    }
    part = part.slice(1).trimStart();
  }
}

export function parse(text: string): unknown {
  const frames: Array<Record<string, unknown> | unknown[]> = [];
  const stack: Array<'object' | 'array'> = [];
  let inString = false;
  let strbuf = '';
  let currentKey: string | null = null;

  const lines = text.split('\n');

  for (let li = 0; li < lines.length; li++) {
    let line = lines[li];
    if (line.endsWith('\r')) line = line.slice(0, -1);

    if (inString) {
      const result = handleStringLine(line);
      if (result !== undefined) {
        inString = false;
        const top = frames[frames.length - 1];
        if (stack[stack.length - 1] === 'object') {
          (top as Record<string, unknown>)[currentKey!] = result.value;
        } else {
          (top as unknown[]).push(result.value);
        }
        if (result.pop > 0) {
          let n = result.pop;
          if (n >= frames.length) n = frames.length - 1;
          for (let p = 0; p < n; p++) {
            frames.pop();
            stack.pop();
          }
        }
        strbuf = '';
      }
      continue;
    }

    if (line.length === 0) continue;

    const rest = line;

    if (frames.length === 0) {
      // Check top-level inline containers: `[ [` or `[ {`
      if (rest.length > 1 && rest[0] === '[') {
        const trimmed = rest.slice(1).trimStart();
        if (trimmed.length > 0 && (trimmed[0] === '[' || trimmed[0] === '{')) {
          parseInlineContainers(rest, frames, stack, null);
          continue;
        }
      }
      if (rest === '{') { frames.push({}); stack.push('object'); continue; }
      if (rest === '[') { frames.push([]); stack.push('array'); continue; }
      throw new PlnError('top level must be { or [');
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

      // Pop suffix for leaf values (not containers)
      let valPart = valPartRaw;
      let valSuffixPop = 0;
      if (valPart.length > 0 && valPart[0] !== '{' && valPart[0] !== '[') {
        const result = trimPopSuffix(valPart);
        valPart = result.value;
        valSuffixPop = result.pop;
      }
      if (valPart.length === 0) continue;

      // Check value inline containers: `key: [ [` or `key: [ {`
      if (valPart.length > 1 && (valPart[0] === '[' || valPart[0] === '{')) {
        const trimmed = valPart.slice(1).trimStart();
        if (trimmed.length > 0 && (trimmed[0] === '[' || trimmed[0] === '{')) {
          parseInlineContainers(valPart, frames, stack, key);
          continue;
        }
      }
      if (valPart === '{') {
        const obj: Record<string, unknown> = {};
        (top as Record<string, unknown>)[key] = obj;
        frames.push(obj); stack.push('object');
      } else if (valPart === '[') {
        const arr: unknown[] = [];
        (top as Record<string, unknown>)[key] = arr;
        frames.push(arr); stack.push('array');
      } else {
        (top as Record<string, unknown>)[key] = parseScalar(valPart);
      }
      if (valSuffixPop > 0) {
        if (valSuffixPop >= frames.length) valSuffixPop = frames.length - 1;
        for (let p = 0; p < valSuffixPop; p++) {
          frames.pop();
          stack.pop();
        }
      }
    } else {
      // Array element pop suffix for leaf values
      let arrVal = rest;
      let arrSuffixPop = 0;
      if (arrVal.length > 0 && arrVal[0] !== '{' && arrVal[0] !== '[') {
        const result = trimPopSuffix(arrVal);
        arrVal = result.value;
        arrSuffixPop = result.pop;
      }
      if (arrVal.length === 0) continue;

      // Check array element inline containers: `[ [`、`[ {`、`{ [`、`{ {`
      if (arrVal.length > 1 && (arrVal[0] === '[' || arrVal[0] === '{')) {
        const trimmed = arrVal.slice(1).trimStart();
        if (trimmed.length > 0 && (trimmed[0] === '[' || trimmed[0] === '{')) {
          parseInlineContainers(arrVal, frames, stack, null);
          continue;
        }
      }
      if (arrVal === '{') {
        const obj: Record<string, unknown> = {};
        (top as unknown[]).push(obj);
        frames.push(obj); stack.push('object');
      } else if (arrVal === '[') {
        const arr: unknown[] = [];
        (top as unknown[]).push(arr);
        frames.push(arr); stack.push('array');
      } else {
        (top as unknown[]).push(parseScalar(arrVal));
      }
      if (arrSuffixPop > 0) {
        if (arrSuffixPop >= frames.length) arrSuffixPop = frames.length - 1;
        for (let p = 0; p < arrSuffixPop; p++) {
          frames.pop();
          stack.pop();
        }
      }
    }
  }

  return frames.length > 0 ? frames[0] : null;
}

function isKeyValid(key: string): boolean {
  if (key.length === 0) return false;
  for (const c of key) {
    if (c === ':' || c === '"' || c === '{' ||
        c === '[' || c === '#' ||
        c === ' ' || c === '\t') return false;
  }
  return true;
}

function parseScalar(s: string): unknown {
  if (s.startsWith('"')) return parseQuoted(s.slice(1));
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  if (s[0] === '-' || (s[0] >= '0' && s[0] <= '9')) {
    if (/[.eE]/.test(s)) {
      const n = Number(s);
      if (!isNaN(n)) return n;
    } else {
      const n = Number(s);
      if (!isNaN(n)) return n;
    }
  }
  throw new PlnError(`bare string must be quoted: ${s}`);
}

function parseQuoted(content: string): string {
  let result = '';
  let i = 0;
  while (i < content.length) {
    if (content[i] === '"') {
      if (i + 1 < content.length && content[i + 1] === '"') {
        result += '"'; i += 2;
      } else {
        const after = content.slice(i + 1);
        if (after.trim().length > 0) throw new PlnError('trailing content after quote');
        return result;
      }
    } else {
      result += content[i]; i++;
    }
  }
  // multi-line
  throw new PlnError('multi-line strings not supported in single-line parser mode');
}

function handleStringLine(line: string): {value: string, pop: number} | undefined {
  let result = '';
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      if (i + 1 < line.length && line[i + 1] === '"') {
        result += '"'; i += 2;
      } else {
        const after = line.slice(i + 1);
        if (after.length > 0) {
          const nPop = popSuffixAfter(after);
          if (nPop < 0) throw new PlnError('trailing content after quote');
          return {value: result, pop: nPop};
        }
        return {value: result, pop: 0};
      }
    } else {
      result += line[i]; i++;
    }
  }
  return undefined; // still open
}
