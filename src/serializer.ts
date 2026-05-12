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
      writeContainerInline(v, true, '[', 'array');
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

  function writeContainerInline(v: unknown, first: boolean, ch: string, typ: 'object' | 'array'): void {
    if (first && stack.length > 0 && stack[stack.length - 1] === 'object' && awaitingValue) {
      buf.push(ch);
      awaitingValue = false;
    } else if (first) {
      flushPop();
      buf.push(ch);
    } else {
      buf.push(ch);
    }

    const arr = v as unknown[];
    const canInline = typ === 'array' && arr.length > 0 &&
      (typeof arr[0] === 'object' && arr[0] !== null && !Array.isArray(arr[0]) || Array.isArray(arr[0]));

    if (canInline) {
      stack.push('array');
      needKey = false; awaitingValue = false;
      writeContainerInline(arr[0], false, Array.isArray(arr[0]) ? '[' : '{', Array.isArray(arr[0]) ? 'array' : 'object');
      for (let i = 1; i < arr.length; i++) writeValue(arr[i]);
      stack.pop();
      pendingPop++;
      if (stack.length > 0 && stack[stack.length - 1] === 'object') needKey = true;
    } else {
      buf.push('\n');
      stack.push(typ);
      needKey = (typ === 'object');
      awaitingValue = false;
      if (typ === 'object') {
        for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
          flushPop();
          buf.push(k, ': ');
          needKey = false; awaitingValue = true;
          writeValue(val);
        }
      } else {
        for (const item of v as unknown[]) writeValue(item);
      }
      stack.pop();
      pendingPop++;
      if (stack.length > 0 && stack[stack.length - 1] === 'object') needKey = true;
    }
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
      buf.push(s);
      flushPop();
      buf.push('\n');
      needKey = true;
    } else {
      buf.push(s);
      flushPop();
      buf.push('\n');
    }
  }

  function putString(s: string) {
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
    flushPop();
    buf.push('\n');
  }

  writeValue(value);
  return buf.join('');
}
