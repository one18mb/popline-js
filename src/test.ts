import { parse, serialize } from './index';
declare const process: { exit: (code: number) => void };

let passed = 0, failed = 0;
function test(name: string, ok: boolean, detail = '') {
  if (ok) { passed++; } else { failed++; console.log(`  FAIL [${name}]: ${detail}`); }
}

// Basic types
const obj1 = parse('{\nname: "popline"\n') as any;
test('simple obj', obj1?.name === 'popline');

const obj2 = parse('{\na: 42\n') as any;
test('int', obj2?.a === 42);

const obj3 = parse('{\na: true\nb: false\nc: null\n') as any;
test('true', obj3?.a === true);
test('false', obj3?.b === false);
test('null', obj3?.c === null);

// Nesting
const obj4 = parse('{\nouter: {\ninner: "value"\n') as any;
test('nested', obj4?.outer?.inner === 'value');

// Pop
const obj5 = parse('{\nouter: {\ninner: "x"\n1 mid: "y"\n') as any;
test('pop 1', obj5?.mid === 'y');

// Strings
const obj6 = parse('{\nmsg: "He said: ""Hello"""\n') as any;
test('escape', obj6?.msg === 'He said: "Hello"');

// Keys
const obj7 = parse('{\n中文键: 1\nmy-key: 2\n') as any;
test('extended keys', obj7?.['中文键'] === 1 && obj7?.['my-key'] === 2);

// Errors
try { parse('42\n'); test('err top scalar', false); }
catch { test('err top scalar', true); }

try { parse('{\nbad:key: 1\n'); test('err key colon', false); }
catch { test('err key colon', true); }

// Roundtrip
function roundtrip(name: string, input: string) {
  try {
    const v = parse(input);
    const s = serialize(v);
    const v2 = parse(s);
    test(name, JSON.stringify(v) === JSON.stringify(v2));
  } catch (e: any) {
    test(name, false, e.message);
  }
}
roundtrip('rt-simple', '{\na: 1\n');
roundtrip('rt-nested', '{\na: {\nb: 1\n1 c: 2\n');
roundtrip('rt-array', '[\n1\n2\n3\n');
roundtrip('rt-mixed', '{\na: [\n1\n2\n1 b: true\n');
roundtrip('rt-boolnull', '{\na: true\nb: false\nc: null\n');

// Complex
const complex = '{\nname: "test"\nversion: 2\nactive: true\ntags: [\n"web"\n"primary"\n1 nested: {\nkey: "val"\n';
roundtrip('rt-complex', complex);

console.log(`\n${passed}/${passed + failed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
