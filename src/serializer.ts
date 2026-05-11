export function serialize(value: unknown): string {
  const buf: string[] = [];
  const stack: Array<'object' | 'array'> = [];
  let pendingPop = 0;
  let needKey = false;
  let awaitingValue = false;

  function flushPop() {
    if (pendingPop > 0) {
      buf.push(String(pendingPop), ' ');
      pendingPop = 0;
    }
  }

  function writeValue(v: unknown): void {
    if (v === null) { putScalar('null'); return; }
    if (typeof v === 'boolean') { putScalar(v ? 'true' : 'false'); return; }
    if (typeof v === 'number') { putScalar(String(v)); return; }
    if (typeof v === 'string') { putString(v); return; }
    if (Array.isArray(v)) {
      startContainer('[');
      stack.push('array');
      needKey = false; awaitingValue = false;
      for (const item of v) writeValue(item);
      stack.pop();
      pendingPop++;
      if (stack.length > 0 && stack[stack.length - 1] === 'object') needKey = true;
      return;
    }
    // object
    startContainer('{');
    stack.push('object');
    needKey = true; awaitingValue = false;
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      flushPop();
      buf.push(k, ': ');
      needKey = false; awaitingValue = true;
      writeValue(val);
    }
    stack.pop();
    pendingPop++;
    if (stack.length > 0 && stack[stack.length - 1] === 'object') needKey = true;
  }

  function startContainer(ch: string) {
    if (stack.length > 0 && stack[stack.length - 1] === 'object' && awaitingValue) {
      buf.push(ch);
      awaitingValue = false;
    } else {
      flushPop();
      buf.push(ch);
    }
    buf.push('\n');
  }

  function putScalar(s: string) {
    if (stack.length > 0 && stack[stack.length - 1] === 'object') {
      awaitingValue = false;
      buf.push(s, '\n');
      needKey = true;
    } else {
      flushPop();
      buf.push(s, '\n');
    }
  }

  function putString(s: string) {
    if (stack.length > 0 && stack[stack.length - 1] === 'object') {
      awaitingValue = false;
      needKey = true;
    } else {
      flushPop();
    }
    buf.push('"');
    for (const c of s) {
      buf.push(c);
      if (c === '"') buf.push('"');
    }
    buf.push('"', '\n');
  }

  writeValue(value);
  return buf.join('');
}
