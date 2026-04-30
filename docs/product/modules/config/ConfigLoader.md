# ConfigLoader — 配置加载器

> **模块**：[config](index.md) | **级别**：标准 | **最后更新**：2026-04-30

## 关系

| 方向 | 类型 | 目标 | 说明 |
|------|------|------|------|
| ← | 被依赖 | [WebhookReceiver](../webhook/WebhookReceiver.md) | 路由时按仓库名查询团队配置 |
| ← | 被依赖 | [NotificationDispatcher](../notification/NotificationDispatcher.md) | 查询 GitHub→Lark 用户映射 |

## 功能

启动时加载 config.yaml，构建 `仓库名 → TeamConfig` 的内存索引，供运行时快速路由查询。

## 状态

| 状态 | 描述 |
|------|------|
| valid | 配置加载成功，仓库索引就绪 |
| ConfigValidationError | 检测到重复仓库，抛出错误，服务拒绝启动 |

## 交互表

| 操作 | 条件 | 行为 | 视觉反馈 |
|------|------|------|----------|
| 构造 ConfigLoader | 配置合法（无重复仓库） | 构建仓库→团队映射索引 | — |
| 构造 ConfigLoader | 存在跨团队重复仓库 | 抛出 ConfigValidationError | 服务启动失败日志 |
| findTeamByRepo | 仓库在配置中 | 返回 `{ found: true, teamConfig }` | — |
| findTeamByRepo | 仓库不在配置中 | 返回 `{ found: false }` | — |
| getLarkUserId | 用户在 user_mappings 中 | 返回 lark_user_id 字符串 | — |
| getLarkUserId | 用户不在 user_mappings 中 | 返回 undefined | — |

## 边界情况

- 同一仓库出现在两个 team 的 repositories → 抛出 ConfigValidationError，消息含重复的仓库名
- user_mappings 为空对象 → 所有用户查询返回 undefined，消息发出但无 @
- repositories 为空数组 → 该团队不接收任何路由

## Non-Goals

- 不支持运行时热更新配置（需重启服务）
- 不支持从远端 URL 拉取配置
- 不自动创建 Lark 用户映射
