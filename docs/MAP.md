# lark-pr-bot — 技术索引

> 生成时间：2026-04-30

## Trace 列表

| ID | 类型 | 标题 | 状态 | 模块 | 日期 |
|----|------|------|------|------|------|
| FEAT-3c25-lark-pr-bot | FEAT | Lark PR 通知机器人 | done | webhook/notification/config | 2026-04-30 |

## API 端点

| 方法 | 路径 | 描述 | Feat |
|------|------|------|------|
| POST | /webhook | 接收 GitHub Webhook 事件 | FEAT-3c25 |
| GET | /health | 健康检查 | FEAT-3c25 |

## 源文件

| 文件 | 描述 |
|------|------|
| src/types/index.ts | 共享类型定义 |
| src/config/configLoader.ts | ConfigLoader |
| src/notification/notificationDispatcher.ts | NotificationDispatcher |
| src/webhook/webhookReceiver.ts | WebhookReceiver |
| src/index.ts | createApp + 生产入口 |

## 技术债

| ID | 优先级 | 描述 | 来源 |
|----|--------|------|------|
| TD-001 | low | NotificationType 枚举未使用 | FEAT-3c25 |
| TD-002 | low | 引入结构化日志 | FEAT-3c25 |
| TD-003 | low | 消息去重（delivery_id） | FEAT-3c25 |
