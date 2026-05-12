export function serialize(value: unknown): string {
  const buf: string[] = [];
  const stack: Array<'object' | 'array'> = [];
  let needKey = false;
  let awaitingValue = false;

  function writeValue(v: unknown, closePop = 0): void {
    if (v === null) { putScalar('null', closePop); return; }
    if (typeof v === 'boolean') { putScalar(v ? 'true' : 'false', closePop); return; }
    if (typeof v === 'number') { putScalar(String(v), closePop); return; }
    if (typeof v === 'string') { putString(v, closePop); return; }
    if (Array.isArray(v)) {
      writeContainerInline(v, true, '[', 'array', closePop);
      return;
    }
    // object
    startContainer('{');
    stack.push('object');
    needKey = true; awaitingValue = false;
    const entries = Object.entries(v as Record<string, unknown>);
    const n = entries.length;
    for (let i = 0; i < n; i++) {
      const [k, val] = entries[i];
      const childPop = (i === n - 1 && stack.length > 1) ? closePop + 1 : 0;
      buf.push(k, ': ');
      needKey = false; awaitingValue = true;
      writeValue(val, childPop);
    }
    stack.pop();
    if (stack.length > 0 && stack[stack.length - 1] === 'object') needKey = true;
  }

  function writeContainerInline(v: unknown, first: boolean, ch: string, typ: 'object' | 'array', closePop: number): void {
    if (first && stack.length > 0 && stack[stack.length - 1] === 'object' && awaitingValue) {
      buf.push(ch);
      awaitingValue = false;
    } else if (first) {
      buf.push(ch);
    } else {
      buf.push(ch);
    }

    // Non-inline path for correct closePop propagation
    buf.push('\n');
    stack.push(typ);
    needKey = (typ === 'object');
    awaitingValue = false;
    if (typ === 'object') {
      const entries = Object.entries(v as Record<string, unknown>);
      const n = entries.length;
      for (let i = 0; i < n; i++) {
        const [k, val] = entries[i];
        const childPop = (i === n - 1) ? closePop + 1 : 0;
        buf.push(k, ': ');
        needKey = false; awaitingValue = true;
        writeValue(val, childPop);
      }
    } else {
      const arr = v as unknown[];
      const n = arr.length;
      for (let i = 0; i < n; i++) {
        const childPop = (i === n - 1) ? closePop + 1 : 0;
        writeValue(arr[i], childPop);
      }
    }
    stack.pop();
    if (stack.length > 0 && stack[stack.length - 1] === 'object') needKey = true;
  }

  function startContainer(ch: string) {
    if (stack.length > 0 && stack[stack.length - 1] === 'object' && awaitingValue) {
      buf.push(ch);
      awaitingValue = false;
    } else {
      buf.push(ch);
    }
    buf.push('\n');
  }

  function putScalar(s: string, closePop: number) {
    if (stack.length > 0 && stack[stack.length - 1] === 'object') {
      awaitingValue = false;
    }
    buf.push(s);
    if (closePop > 0) buf.push(' ', String(closePop));
    buf.push('\n');
    if (stack.length > 0 && stack[stack.length - 1] === 'object') {
      needKey = true;
    }
  }

  function putString(s: string, closePop: number) {
    if (stack.length > 0 && stack[stack.length - 1] === 'object') {
      awaitingValue = false;
      needKey = true;
    }
    buf.push('"');
    for (const c of s) {
      buf.push(c);
      if (c === '"') buf.push('"');
    }
    buf.push('"');
    if (closePop > 0) buf.push(' ', String(closePop));
    buf.push('\n');
  }

  writeValue(value);
  return buf.join('');
}
