import { PopLineError } from './types';

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
          (top as Record<string, unknown>)[currentKey!] = result;
        } else {
          (top as unknown[]).push(result);
        }
        strbuf = '';
      }
      continue;
    }

    if (line.length === 0) continue;

    // pop prefix
    let nPop = 0;
    let valueStart = 0;
    let i = 0;
    while (i < line.length && line[i] >= '0' && line[i] <= '9') i++;
    if (i > 0 && i < line.length && line[i] === ' ') {
      nPop = parseInt(line.slice(0, i), 10);
      valueStart = i + 1;
    }

    for (let p = 0; p < nPop; p++) {
      frames.pop();
      stack.pop();
    }

    const rest = line.slice(valueStart);
    if (rest.length === 0) throw new PopLineError('bare pop line');

    if (frames.length === 0) {
      if (rest === '{') { frames.push({}); stack.push('object'); continue; }
      if (rest === '[') { frames.push([]); stack.push('array'); continue; }
      throw new PopLineError('top level must be { or [');
    }

    const top = frames[frames.length - 1];
    const topType = stack[stack.length - 1];

    if (topType === 'object') {
      const sep = rest.indexOf(': ');
      if (sep < 0) throw new PopLineError(`object line must be 'key: value': ${rest}`);
      const key = rest.slice(0, sep);
      if (!isKeyValid(key)) throw new PopLineError(`invalid key: ${key}`);
      const valPart = rest.slice(sep + 2);

      currentKey = key;
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
    } else {
      if (rest === '{') {
        const obj: Record<string, unknown> = {};
        (top as unknown[]).push(obj);
        frames.push(obj); stack.push('object');
      } else if (rest === '[') {
        const arr: unknown[] = [];
        (top as unknown[]).push(arr);
        frames.push(arr); stack.push('array');
      } else {
        (top as unknown[]).push(parseScalar(rest));
      }
    }
  }

  return frames.length > 0 ? frames[0] : null;
}

function isKeyValid(key: string): boolean {
  if (key.length === 0) return false;
  for (const c of key) {
    if (c === ':' || c === '"' || c === '{' || c === '}' ||
        c === '[' || c === ']' || c === '#' ||
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
  throw new PopLineError(`bare string must be quoted: ${s}`);
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
        if (after.trim().length > 0) throw new PopLineError('trailing content after quote');
        return result;
      }
    } else {
      result += content[i]; i++;
    }
  }
  // multi-line
  throw new PopLineError('multi-line strings not supported in single-line parser mode');
}

function handleStringLine(line: string): string | undefined {
  let result = '';
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      if (i + 1 < line.length && line[i + 1] === '"') {
        result += '"'; i += 2;
      } else {
        const after = line.slice(i + 1);
        if (after.trim().length > 0) throw new PopLineError('trailing content after quote');
        return result;
      }
    } else {
      result += line[i]; i++;
    }
  }
  return undefined; // still open
}
