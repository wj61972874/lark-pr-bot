# WebhookReceiver — Webhook 签名验证器

> **模块**：[webhook](index.md) | **级别**：完整 | **最后更新**：2026-04-30

## 关系

| 方向 | 类型 | 目标 | 说明 |
|------|------|------|------|
| → | 依赖 | [ConfigLoader](../config/ConfigLoader.md) | 路由时查询仓库→团队映射 |
| → | 触发 | [NotificationDispatcher](../notification/NotificationDispatcher.md) | 验签路由成功后触发派发 |

## 功能

对每个进入的 GitHub Webhook 请求执行 HMAC-SHA256 签名验证，并将通过验证的合法事件路由到对应团队的通知派发器。

## 交互

| 事件 | 条件 | 行为 | 视觉反馈 |
|------|------|------|----------|
| POST /webhook 到达 | 有签名头 + 有效 secret | 验签 → 路由 → 派发 → 返回 200 | — |
| POST /webhook 到达 | 签名缺失或验证失败 | 拒绝请求 | 返回 401 |
| 已验签事件 | 仓库不在配置中 | 静默丢弃 | 返回 200 |
| 已验签事件 | 不支持的事件类型 | 静默丢弃 | 返回 200 |

## 不变式

| ID | 规则 |
|----|------|
| INV-01 | 签名验证失败必须返回 401，不执行任何业务逻辑 |
| INV-02 | 配置中同一仓库不能属于多个团队（启动时校验） |
| INV-03 | Lark 发送失败不影响 Webhook 200 响应 |
| INV-04 | 未配置仓库的事件静默丢弃，返回 200 |

## 状态机

| 当前状态 | 触发事件 | 动作 | 下一状态 |
|----------|----------|------|----------|
| IDLE | POST /webhook 到达 | 读取请求头和 rawBody | VERIFYING |
| VERIFYING | 签名有效 | 解析事件类型 | ROUTING |
| VERIFYING | 签名无效/缺失 | 返回 401，记录 warn | REJECTED |
| ROUTING | 找到 teamConfig | 传递 event + teamConfig | DISPATCHING |
| ROUTING | 未找到 teamConfig / 不支持事件 | 返回 200，记录 debug | IGNORED |
| DISPATCHING | Lark 调用完成（成功或失败） | 返回 200，失败时记录 error | COMPLETED |

终态（单次请求）：REJECTED、IGNORED、COMPLETED → 服务回到 IDLE

## 故障旅程

| 故障场景 | 检测方式 | 降级策略 | 恢复路径 |
|----------|----------|----------|----------|
| GitHub 签名验证失败 | HMAC 比对不匹配 | 返回 401，记录 warn | 检查 GITHUB_WEBHOOK_SECRET 配置 |
| GITHUB_WEBHOOK_SECRET 未设置 | 启动时检查 | 服务启动失败，exit(1) | 设置环境变量后重启 |
| 仓库不在配置中 | findTeamByRepo 返回 found=false | 静默返回 200，记录 debug | 在 config.yaml 中添加仓库配置 |
| Lark 发送失败（5xx/超时） | try/catch 捕获 | 记录 error，仍返回 200 | 检查 Lark webhook URL 和网络 |
| config.yaml 不存在或格式错误 | yaml.load 抛出异常 | 服务启动失败，exit(1) | 检查 CONFIG_PATH 和文件格式 |

## 已知限制

- 不做消息去重（同一 delivery_id 重复投递会发多条 Lark 消息）
- 不支持 GitHub 以外的 Git 平台

## Non-Goals

- 不处理 GitHub push/issues/release 等非 PR 事件
- 不提供 Lark 交互式回调处理
