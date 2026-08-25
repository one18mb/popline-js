# PopLine JS

PopLine 序列化格式的 JavaScript/TypeScript 实现。纯 TS，零依赖。

## 安装

```bash
npm install popline
```

## 使用

```typescript
import { Pln } from 'popline';

// PopLine → JS 对象
const obj = Pln.parse('{\nkey: "value"\n');
// → { key: "value" }

// JS 对象 → PopLine
const text = Pln.stringify({ key: "value" });
// → '{\nkey: "value"\n'
```

## 性能

测试数据：`test.json`（17011 B）→ `test.pln`（13076 B，**76.9%**），2000 次迭代

| 操作 | JSON (V8 原生) | popline (TS) | 比 |
|------|---------------|-------------|------|
| 解析 | 103 µs/op | 425 µs/op | 4.1x |
| 序列化 | 49 µs/op | — | — |

V8 的 JSON.parse 为原生 C++ 深度 JIT 优化，PopLine 作为文本序列化格式，核心优势在体积（-23%）和可读性，非运行速度。

## 体验

在线格式转换（PopLine ↔ JSON/YAML/TOML/INI/XML）：[popline-converter](https://one18mb.github.io/popline-converter/)

## 构建

```bash
npm install
npm run build
npm test
```

## 致谢

本项目的开发得到了以下 AI 工具的大力协助：
- [DeepSeek](https://deepseek.com）（深度求索）
