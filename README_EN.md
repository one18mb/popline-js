# PopLine JS

JavaScript/TypeScript implementation of the PopLine serialization format.

> Pure TypeScript, no native optimizations. For production, consider the [C extension](https://github.com/one18mb/popline-py) or [Go version](https://github.com/one18mb/popline-go).

## Install

```bash
npm install popline-js
```

## Usage

```typescript
import { Pln } from 'popline-js';

// Parse
const obj = Pln.parse('{\nkey: "value"\n');

// Serialize
const text = Pln.stringify({ key: 'value' });
```

## Performance

Data: `test.json` (17011 B) / `test.pln` (13074 B, 76.9%)

| Operation | JSON (built-in) | popline-js | Ratio |
|-----------|----------------|------------|-------|
| Parse | 410 ms (82 µs/op) | 3306 ms (661 µs/op) | 8.06x |
| Serialize | 235 ms (47 µs/op) | 2401 ms (480 µs/op) | 10.20x |

## Build

```bash
npm install
npm run build
npm test
```

## Acknowledgments
This project was developed with the assistance of:
- [Claude Code](https://claude.ai) (Anthropic)
- [DeepSeek](https://deepseek.com) (DeepSeek)
