# lark-pr-bot 产品地图

> GitHub PR 事件 → HMAC 验签 → 路由 → Lark 群卡片通知

**最后更新**：2026-04-30

## 产品定位

当 GitHub 仓库发生 PR 相关事件时，自动向对应 Lark 群发送卡片通知，并 @ 相关成员（Reviewer 或 PR 创建者）。支持多团队各自配置仓库与 Lark 群的对应关系。

## 模块索引

| 模块 | 路径 | 职责 | 核心组件 |
|------|------|------|----------|
| webhook | [modules/webhook/](modules/webhook/index.md) | 接收 GitHub Webhook、验签、路由 | [WebhookReceiver](modules/webhook/WebhookReceiver.md) |
| notification | [modules/notification/](modules/notification/index.md) | 构建 Lark 卡片消息并发送 | [NotificationDispatcher](modules/notification/NotificationDispatcher.md) |
| config | [modules/config/](modules/config/index.md) | 加载仓库→群映射和用户映射 | [ConfigLoader](modules/config/ConfigLoader.md) |

## 数据流

```
GitHub → POST /webhook
           ↓ HMAC 验签（WebhookReceiver）
           ↓ 路由：repoFullName → TeamConfig（ConfigLoader）
           ↓ 构建卡片（NotificationDispatcher）
           ↓ POST → Lark Webhook URL
```
