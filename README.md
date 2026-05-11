# PopLine JS

PopLine 序列化格式的 JavaScript/TypeScript 实现。

## 安装

```bash
npm install popline-js
```

## 使用

```typescript
import { parse, serialize } from 'popline-js';

// 解析
const obj = parse('{\nkey: "value"\n');

// 序列化
const text = serialize({ key: 'value' });
```

## 性能

> 纯 TypeScript 实现，无原生优化。生产环境建议使用 [C 扩展](https://github.com/one18mb/popline-py) 或 [Go 版本](https://github.com/one18mb/popline-go)。

测试数据：`package.json`（17011 B）→ `package.pln`（13074 B，**76.9%**），5000 次迭代

| 操作 | JSON (built-in) | popline-js | 比 |
|------|----------------|------------|------|
| 解析 | 410 ms (82 µs/op) | 3306 ms (661 µs/op) | 8.06x |
| 序列化 | 235 ms (47 µs/op) | 2401 ms (480 µs/op) | 10.20x |

## 构建

```bash
npm install
npm run build
npm test
```
