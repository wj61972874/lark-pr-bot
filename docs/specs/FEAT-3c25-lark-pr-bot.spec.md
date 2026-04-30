# FEAT-3c25-lark-pr-bot OpenSpec

> 来源：docs/traces/FEAT-3c25-lark-pr-bot.md
> 组件模板级别：完整级
> 可导入类型：src/types/index.ts

---

## 数据结构

### 配置（Config）

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `teams` | `TeamConfig[]` | ✓ | 所有团队配置列表 |

**TeamConfig**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | ✓ | 团队标识名 |
| `lark_webhook` | `string` | ✓ | Lark 群机器人 Webhook URL |
| `repositories` | `string[]` | ✓ | 关联仓库列表，格式 `owner/repo` |
| `user_mappings` | `Record<string, string>` | ✓ | `github_username → lark_user_id` |

约束：`repositories` 中每个值在所有 teams 中必须唯一（INV-02）。

---

### GitHub Webhook 事件

**GitHubUser**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `login` | `string` | ✓ | GitHub 用户名 |
| `avatar_url` | `string` | ✓ | 头像 URL |
| `html_url` | `string` | ✓ | 主页 URL |

**GitHubRepository**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `full_name` | `string` | ✓ | `owner/repo` 格式 |
| `html_url` | `string` | ✓ | 仓库主页 URL |

**GitHubPullRequest**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `number` | `number` | ✓ | PR 编号 |
| `title` | `string` | ✓ | PR 标题 |
| `body` | `string \| null` | ✓ | PR 描述 |
| `html_url` | `string` | ✓ | PR 页面 URL |
| `user` | `GitHubUser` | ✓ | PR 创建者 |
| `requested_reviewers` | `GitHubUser[]` | ✓ | 指定的 Reviewer 列表 |
| `merged` | `boolean` | ✓ | 是否已 merge |
| `state` | `'open' \| 'closed'` | ✓ | PR 状态 |

**GitHubReview**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `state` | `PullRequestReviewState` | ✓ | review 类型 |
| `body` | `string \| null` | ✓ | review 评论内容 |
| `html_url` | `string` | ✓ | review 页面 URL |
| `user` | `GitHubUser` | ✓ | reviewer |

**PullRequestEvent**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `action` | `PullRequestAction` | ✓ | 事件动作 |
| `pull_request` | `GitHubPullRequest` | ✓ | PR 数据 |
| `repository` | `GitHubRepository` | ✓ | 所属仓库 |
| `sender` | `GitHubUser` | ✓ | 触发者 |

**PullRequestReviewEvent**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `action` | `'submitted'` | ✓ | 固定为 submitted |
| `review` | `GitHubReview` | ✓ | review 数据 |
| `pull_request` | `GitHubPullRequest` | ✓ | PR 数据 |
| `repository` | `GitHubRepository` | ✓ | 所属仓库 |
| `sender` | `GitHubUser` | ✓ | 触发者 |

---

### 通知（Notification）

**LarkCardMessage**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `msg_type` | `'interactive'` | ✓ | 固定值 |
| `card` | `LarkCard` | ✓ | 卡片内容 |

**LarkCard**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `header` | `LarkCardHeader` | ✓ | 卡片头部 |
| `elements` | `LarkCardElement[]` | ✓ | 内容元素列表 |

**LarkCardHeader**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `title` | `{ tag: 'plain_text'; content: string }` | ✓ | 标题 |
| `template` | `LarkCardColor` | ✓ | 颜色主题 |

**RouteResult**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `found` | `boolean` | ✓ | 是否找到对应团队配置 |
| `teamConfig` | `TeamConfig \| undefined` | - | 找到时返回团队配置 |

---

## 枚举定义

### PullRequestAction
```
opened    — PR 创建（触发通知 Reviewer）
closed    — PR 关闭（含 merged=true 的 merge，和普通 close）
```

### PullRequestReviewState
```
approved           — Reviewer 批准
changes_requested  — Reviewer 要求修改
commented          — Reviewer 留下评论（无明确结论）
```

### LarkCardColor
```
blue    — 新 PR 创建（信息）
green   — approved / merged（正向）
red     — changes_requested / closed（需关注）
orange  — review comment（中性提醒）
```

### NotificationType
```
PR_OPENED            — 新建 PR，通知 Reviewers
PR_MERGED            — PR 已 merge，通知创建者
PR_CLOSED            — PR 已关闭（非 merge），通知创建者
REVIEW_APPROVED      — Reviewer 批准，通知创建者
REVIEW_CHANGES       — Reviewer 要求修改，通知创建者
REVIEW_COMMENTED     — Reviewer 评论，通知创建者
```

---

## 常量

```
SUPPORTED_GITHUB_EVENTS    = ['pull_request', 'pull_request_review']
SUPPORTED_PR_ACTIONS       = ['opened', 'closed']
SUPPORTED_REVIEW_ACTIONS   = ['submitted']
WEBHOOK_PATH               = '/webhook'
DEFAULT_PORT               = 3000
BODY_TRUNCATE_LENGTH       = 200   // PR body 摘要截断长度
```

---

## API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/webhook` | 接收 GitHub Webhook 事件 |
| GET | `/health` | 健康检查 |

**POST /webhook 请求**

| Header | 必填 | 描述 |
|--------|------|------|
| `X-Hub-Signature-256` | ✓ | HMAC-SHA256 签名，格式 `sha256={hex}` |
| `X-GitHub-Event` | ✓ | 事件类型 |
| `Content-Type` | ✓ | `application/json` |

**POST /webhook 响应**

| 状态码 | 条件 |
|--------|------|
| `200 OK` | 所有正常路径（含忽略事件、Lark 发送失败） |
| `401 Unauthorized` | 签名验证失败 |
| `400 Bad Request` | 请求体解析失败 |

---

## 不变式（Invariants）

| ID | 规则 | 可测试断言 |
|----|------|-----------|
| INV-01 | 签名验证失败必须返回 401，不执行任何业务逻辑 | 伪造签名 → response.status === 401，notificationDispatcher 未被调用 |
| INV-02 | 同一仓库不能属于多个 team | ConfigLoader 加载时检测重复，抛出 ConfigValidationError |
| INV-03 | Lark 发送失败不影响 Webhook 200 响应 | mock Lark 返回 500 → response.status === 200，错误已记录日志 |
| INV-04 | 未配置仓库的事件静默丢弃返回 200 | 发送未知仓库事件 → response.status === 200，notificationDispatcher 未被调用 |

---

## 状态机（FSM）— WebhookReceiver

| 当前状态 | 触发事件 | 动作 | 下一状态 |
|----------|----------|------|----------|
| IDLE | POST /webhook 到达 | 读取请求头和 body | VERIFYING |
| VERIFYING | 签名有效 | 解析事件类型 | ROUTING |
| VERIFYING | 签名无效 | 返回 401，记录 warn | REJECTED |
| ROUTING | 找到 teamConfig | 传递 event + teamConfig | DISPATCHING |
| ROUTING | 未找到 teamConfig | 返回 200，记录 debug | IGNORED |
| DISPATCHING | Lark 调用完成（成功或失败） | 返回 200，失败时记录 error | COMPLETED |

终态：REJECTED、IGNORED、COMPLETED（均为单次请求终态，服务本身回到 IDLE）

---

## 故障旅程（Failure Journeys）

| 故障场景 | 检测方式 | 降级策略 | 恢复路径 |
|----------|----------|----------|----------|
| GitHub 重复投递（同一事件多次） | 无去重机制 | 发送多条 Lark 消息（Non-Goal：不去重） | 后续版本可加 delivery_id 去重 |
| Lark Webhook URL 失效（4xx/5xx） | HTTP 响应状态码 | 记录 error 日志，返回 200 给 GitHub | 检查 config.yaml 中的 webhook URL |
| Lark 网络超时 | 请求超时（5s） | 记录 error 日志，返回 200 给 GitHub | 检查网络连通性 |
| config.yaml 不存在或格式错误 | YAML 解析异常 | 服务启动失败，打印错误信息退出（exit code 1） | 检查 config.yaml 路径和格式 |
| 环境变量 GITHUB_WEBHOOK_SECRET 未设置 | 启动时检查 | 服务启动失败，打印错误退出 | 设置环境变量 |
| GitHub payload 格式异常（字段缺失） | TypeScript 类型守卫 | 记录 warn，返回 400 | 检查 GitHub Webhook 版本 |

---

## 验收标准 → 类型映射

| 验收标准 | 对应类型/常量 |
|----------|--------------|
| Reviewer 收到卡片通知 | `NotificationType.PR_OPENED` + `LarkCardColor.blue` |
| Review submitted 通知创建者 | `NotificationType.REVIEW_*` + `PullRequestReviewState` |
| PR approved/merged/closed 通知 | `NotificationType.PR_MERGED/PR_CLOSED/REVIEW_APPROVED` |
| 签名失败返回 401 | `INV-01` |
| 映射缺失不 @ 用户 | `TeamConfig.user_mappings` 查找返回 undefined |
| 多团队隔离 | `RouteResult` 路由逻辑 |
