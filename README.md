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

## 构建

```bash
npm install
npm run build
npm test
```
