# PopLine JS

JavaScript/TypeScript implementation of the PopLine serialization format.

> Pure TypeScript, no native optimizations. For production, consider the [C extension](https://github.com/one18mb/popline-py) or [Go version](https://github.com/one18mb/popline-go).

## Install

```bash
npm install popline-js
```

## Usage

```typescript
import { parse, serialize } from 'popline-js';

// Parse
const obj = parse('{\nkey: "value"\n');

// Serialize
const text = serialize({ key: 'value' });
```

## Performance

Data: `package.json` (17011 B) / `package.pln` (13074 B, 76.9%)

| Operation | JSON (built-in) | popline-js | Ratio |
|-----------|----------------|------------|-------|
| Parse | 410 ms | 3306 ms | 8.06x |
| Serialize | 235 ms | 2401 ms | 10.20x |

## Build

```bash
npm install
npm run build
npm test
```
