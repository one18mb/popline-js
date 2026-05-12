import { Pln } from './index';
import * as fs from 'fs';
const { parse, stringify: serialize } = Pln;
declare const process: { exit: (code: number) => void };

let passed = 0, failed = 0;
function test(name: string, ok: boolean, detail = '') {
  if (ok) { passed++; } else { failed++; console.log(`  FAIL [${name}]: ${detail}`); }
}

// ═══════════════ Unit Tests ═══════════════

const obj1 = parse('{\nname: "popline"\n') as any;
test('simple obj', obj1?.name === 'popline');

const obj2 = parse('{\na: 42\n') as any;
test('int', obj2?.a === 42);

const obj3 = parse('{\na: 3.14\n') as any;
test('float', typeof obj3?.a === 'number');

const obj4 = parse('{\na: true\nb: false\nc: null\n') as any;
test('true', obj4?.a === true);
test('false', obj4?.b === false);
test('null', obj4?.c === null);

const obj5 = parse('{\nouter: {\ninner: "value"\n') as any;
test('nested', obj5?.outer?.inner === 'value');

const obj6 = parse('{\nouter: {\ninner: "x" 1\nmid: "y"\n') as any;
test('pop 1', obj6?.mid === 'y');

const obj7 = parse('{\na: {\nb: {\nc: "deep" 2\nx: "top"\n') as any;
test('pop 2', obj7?.x === 'top');

const obj8 = parse('{\nmsg: "He said: ""Hello"""\n') as any;
test('escape', obj8?.msg === 'He said: "Hello"');

const obj9 = parse('{\nkey: "你好世界"\n') as any;
test('chinese', obj9?.key === '你好世界');

const obj10 = parse('{\n中文键: 1\nmy-key: 2\na.b.c: 3\n') as any;
test('ext keys', obj10?.['中文键'] === 1 && obj10?.['my-key'] === 2);

// Errors
try { parse('42\n'); test('err scalar', false); } catch { test('err scalar', true); }
try { parse('{\nbad:key: 1\n'); test('err key colon', false); } catch { test('err key colon', true); }

// ═══════════════ Roundtrip ═══════════════

function roundtrip(name: string, input: string) {
  try {
    const v = parse(input);
    const s = serialize(v as any);
    const v2 = parse(s);
    test(name, JSON.stringify(v) === JSON.stringify(v2));
  } catch (e: any) { test(name, false, e.message); }
}
roundtrip('rt-simple', '{\na: 1\n');
roundtrip('rt-nested', '{\na: {\nb: 1\n1 c: 2\n');
roundtrip('rt-array', '[\n1\n2\n3\n');
roundtrip('rt-boolnull', '{\na: true\nb: false\nc: null\n');

// ═══════════════ Real Data Consistency ═══════════════

const jsonPath = 'package.json';
const plnPath = 'package.pln';

if (fs.existsSync(jsonPath) && fs.existsSync(plnPath)) {
  const jsonText = fs.readFileSync(jsonPath, 'utf-8');
  const plnText = fs.readFileSync(plnPath, 'utf-8');
  const jsonObj = JSON.parse(jsonText);

  // PopLine parse and check equality with JSON
  const plnObj = parse(plnText) as any;
  test('real-parse', JSON.stringify(plnObj) === JSON.stringify(jsonObj));

  // PopLine roundtrip
  const rt = serialize(plnObj);
  const rtObj = parse(rt) as any;
  test('real-rt', JSON.stringify(rtObj) === JSON.stringify(jsonObj));

  // JSON → PopLine → object
  const fromJson = serialize(jsonObj);
  const back = parse(fromJson) as any;
  test('real-json-to-pl', JSON.stringify(back) === JSON.stringify(jsonObj));

  console.log(`  data: JSON=${jsonText.length}B, PopLine=${plnText.length}B (${(plnText.length/jsonText.length*100).toFixed(1)}%)`);

  // ═══════════════ Performance ═══════════════

  console.log('\n── Performance (5000 iterations) ──');
  const N = 5000;

  function bench(label: string, fn: () => void) {
    fn(); // warmup
    const t0 = performance.now();
    for (let i = 0; i < N; i++) fn();
    const t1 = performance.now();
    const total = t1 - t0;
    console.log(`  ${label.padEnd(20)} ${total.toFixed(1).padStart(8)} ms  ${(total/N*1000).toFixed(1).padStart(8)} us/op`);
    return total;
  }

  const jser = bench('JSON.stringify', () => JSON.stringify(jsonObj));
  const plser = bench('serialize', () => serialize(plnObj));
  console.log(`  ${'PopLine/JSON'.padEnd(20)} ${(plser/jser).toFixed(2).padStart(8)}x`);

  const jlde = bench('JSON.parse', () => JSON.parse(jsonText));
  const plpa = bench('parse', () => parse(plnText));
  console.log(`  ${'PopLine/JSON'.padEnd(20)} ${(plpa/jlde).toFixed(2).padStart(8)}x`);
}

// ═══════════════ Summary ═══════════════

console.log(`\n${passed}/${passed + failed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
