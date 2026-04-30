# NotificationDispatcher — Lark 卡片通知派发器

> **模块**：[notification](index.md) | **级别**：完整 | **最后更新**：2026-04-30

## 关系

| 方向 | 类型 | 目标 | 说明 |
|------|------|------|------|
| ← | 被触发 | [WebhookReceiver](../webhook/WebhookReceiver.md) | 验签路由成功后接收事件 |
| → | 依赖 | [ConfigLoader](../config/ConfigLoader.md) | 查询 GitHub→Lark 用户映射 |

## 功能

接收 GitHub 事件和团队配置，将事件转换为对应类型的 Lark 交互式卡片消息，并通过 HTTP POST 发送到团队的 Lark Webhook URL。

## 事件→卡片映射表

| GitHub 事件 | 条件 | 卡片颜色 | @ 目标 | 视觉反馈 |
|-------------|------|----------|--------|----------|
| pull_request opened | — | 蓝色 | 所有 requested_reviewers | 卡片含 PR 标题/仓库/描述摘要/跳转按钮 |
| pull_request closed | merged=false | 红色 | PR 创建者 | 卡片含关闭状态/操作人/跳转按钮 |
| pull_request closed | merged=true | 绿色 | PR 创建者 | 卡片含 Merge 状态/操作人/跳转按钮 |
| pull_request_review submitted | state=approved | 绿色 | PR 创建者 | 卡片含 Approved 标签/review 摘要/跳转按钮 |
| pull_request_review submitted | state=changes_requested | 红色 | PR 创建者 | 卡片含 Changes Requested 标签/review 摘要/跳转按钮 |
| pull_request_review submitted | state=commented | 橙色 | PR 创建者 | 卡片含 Commented 标签/review 摘要/跳转按钮 |

## 不变式

| ID | 规则 |
|----|------|
| INV-03 | 向 Lark 发送失败（任何原因）不抛出异常，只记录错误日志 |

## 状态机

| 当前状态 | 触发 | 动作 | 下一状态 |
|----------|------|------|----------|
| IDLE | dispatch 调用 | 构建卡片消息 | SENDING |
| SENDING | Lark 返回成功 | — | COMPLETED |
| SENDING | Lark 抛出异常/超时 | 记录 error 日志 | ERROR_LOGGED |
| COMPLETED / ERROR_LOGGED | — | 返回 void | IDLE |

## 故障旅程

| 故障场景 | 检测方式 | 降级策略 | 恢复路径 |
|----------|----------|----------|----------|
| Lark Webhook URL 返回 4xx/5xx | HTTP 响应状态码 | 记录 error 日志，静默返回 | 检查 config.yaml 中的 lark_webhook URL |
| Lark 请求超时（5s） | axios timeout | 记录 error 日志，静默返回 | 检查网络连通性 |
| GitHub 用户无 Lark 映射 | user_mappings 查找返回 undefined | 跳过该用户的 @，消息正常发出 | 在 config.yaml user_mappings 中添加映射 |
| 不支持的事件类型传入 | buildMessage 返回 null | 静默忽略，不发送消息 | — |

## 边界情况

- PR body 超过 200 字符 → 截断为 200 字符后展示
- reviewer 列表为空 → 正常发卡片但无 @ 用户
- 所有 reviewer 均无映射 → 正常发卡片但无 @ 用户
- review body 为 null → 卡片正文区留空

## Non-Goals

- 不支持 Lark 文本消息格式（仅卡片）
- 不做消息去重
- 不处理 Lark 卡片回调/交互
- 不展示 PR diff 或代码内容
