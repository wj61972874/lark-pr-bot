# notification 模块

> **最后更新**：2026-04-30

## 职责

将 GitHub PR 事件转换为 Lark 交互式卡片消息，并发送到对应团队的 Lark 群 Webhook URL。

## 用户旅程

### 旅程 1：PR 创建通知

Reviewer 在 Lark 群收到蓝色卡片 → 卡片显示仓库名、PR 标题、PR 描述摘要、操作人 → @ 指定的所有 Reviewer → 点击"查看 PR"按钮跳转到 GitHub

### 旅程 2：Review 提交通知

PR 创建者在 Lark 群收到卡片 → 卡片颜色反映 review 结果（绿=approved / 红=changes requested / 橙=commented）→ 显示 review 评论摘要 → 点击按钮跳转

### 旅程 3：PR 状态变更通知

PR 创建者在 Lark 群收到状态卡片 → 绿色表示已 merge，红色表示已关闭 → 显示操作人

### 异常旅程

**Lark 发送失败**：网络超时或 Lark 返回 5xx → 错误被捕获记录日志 → 上层 Webhook 仍返回 200 → 本次通知静默丢失（不影响下次事件）

**用户映射缺失**：GitHub 用户无对应 Lark ID → 消息正常发出 → 跳过该用户的 @ → 其他 @ 正常发出

## 组件索引

| 组件 | 级别 | 职责 |
|------|------|------|
| [NotificationDispatcher](NotificationDispatcher.md) | 完整 | 构建 Lark 卡片 + 发送 |
