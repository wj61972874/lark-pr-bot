# lark-pr-bot

GitHub PR 通知 → Lark 群卡片消息的 Webhook 服务。

## 技术栈

- **语言**：TypeScript (Node.js)
- **运行时**：Node.js 20+
- **框架**：Express
- **测试**：Vitest
- **配置**：YAML（config.yaml，gitignored）

## 目录约定

- `src/types/` — 共享类型定义（所有 interface / type / enum）
- `src/webhook/` — WebhookReceiver：接收 & 验签 & 路由
- `src/notification/` — NotificationDispatcher：构建并发送 Lark 卡片
- `src/config/` — ConfigLoader：加载 config.yaml
- `tests/` — 单元测试（*.test.ts）
- `docs/specs/` — OpenSpec 合约文档（Markdown，不被代码 import）
- `docs/traces/` — 需求 trace 文件

## 命令

- `npm run dev` — 开发模式（ts-node-dev）
- `npm run build` — 编译到 dist/
- `npm start` — 运行编译产物
- `npm test` — 运行测试（vitest run）
- `npm run test:watch` — 监听模式

## 测试命令

```
npx vitest run {file}       # 单文件
npx vitest run              # 全量
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `GITHUB_WEBHOOK_SECRET` | GitHub Webhook 签名密钥 |
| `CONFIG_PATH` | config.yaml 路径（默认 ./config.yaml） |
| `PORT` | 服务端口（默认 3000） |

## 安全约束

- config.yaml 含敏感 URL，已加入 .gitignore
- Webhook Secret 通过环境变量注入，禁止硬编码
