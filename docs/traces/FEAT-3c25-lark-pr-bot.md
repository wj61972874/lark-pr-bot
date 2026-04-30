# FEAT-3c25-lark-pr-bot: Lark PR 通知机器人

> mode: dev

## 当前产品状态（Before）

> 新项目，无现有产品地图。建议完成开发后运行 `/origin` 引导产品文档。
> 组件模板级别：**完整级**

当前团队使用 GitHub 管理代码，PR 流程（创建、review、合并/关闭）完全在 GitHub 站内流转，无任何 Lark 群内通知机制。Reviewer 依赖邮件或主动登录 GitHub 感知待处理 PR，信息严重滞后。

---

## 场景

**场景 1 — PR 创建，通知 Reviewer**

小王是前端团队成员，完成功能分支后在 GitHub 提交 PR，指定小李、小张为 Reviewer。机器人自动在前端 Lark 群发送卡片消息，@小李 @小张，告知有新 PR 待 review，卡片显示 PR 标题、仓库名、描述摘要、跳转按钮。

**场景 2 — Review Submit，通知 PR 创建者**

小李完成 review，点击 GitHub 上的 "Submit review"，留下整体评论和若干 inline 评论。机器人在 Lark 群 @小王，发送卡片消息，显示：review 类型（Comment / Request Changes / Approved）、小李的评论正文摘要、PR 标题和跳转链接。**单条 inline comment 不触发通知。**

**场景 3 — PR 状态变更，通知 PR 创建者**

小李 approve 了 PR，或 PM 直接 merge，或小张 request changes 后小王关闭了 PR。机器人 @小王，发送卡片消息，告知 PR 当前状态（approved / merged / closed），附带操作人和 PR 链接。

**场景 4 — 后端团队接入**

后端 leader 小陈在配置文件中新增一条记录：后端的 3 个仓库 → 后端 Lark 群 webhook，以及后端成员的 GitHub→Lark 映射，与前端配置完全隔离。

---

## 关键规则

- 每个 GitHub 仓库只属于一个 Lark 群（多对一：多仓库 → 一群）
- 多团队各自维护独立配置，互相隔离
- GitHub 用户 → Lark 用户通过静态配置表手动映射；若映射不存在，消息仍发出但不 @ 该用户
- Webhook Secret 必须验证（HMAC-SHA256），验证失败返回 401
- 所有通知消息均为 Lark 卡片格式（Interactive Card）
- 消息内容需包含：仓库名、PR 编号、PR 标题、触发人、状态/动作、跳转按钮
- Review 事件只监听 `review_submitted`，不通知单条 inline comment

---

## 不变式

- **INV-01**：每条 GitHub Webhook 事件必须验证签名，验证失败直接拒绝，不处理任何业务逻辑
- **INV-02**：配置文件中仓库名（`owner/repo` 格式）是路由的唯一 key，不允许重复
- **INV-03**：Lark 消息发送失败不影响 Webhook 响应（返回 200），失败需记录日志
- **INV-04**：未配置的仓库的 Webhook 事件静默丢弃（不报错、不发消息）

---

## 验收标准

- [ ] 新建 PR 时，指定的 Reviewer 在 Lark 群收到卡片 @通知
- [ ] Reviewer submit review 时，PR 创建者在群收到卡片 @通知，显示 review 类型和评论摘要
- [ ] PR 被 approve 时，PR 创建者在群收到卡片通知
- [ ] PR 被 merge 时，PR 创建者在群收到卡片通知
- [ ] PR 被 close 时，PR 创建者在群收到卡片通知
- [ ] 多团队配置互相隔离，前端仓库消息只进前端群
- [ ] GitHub 用户无 Lark 映射时，消息正常发出，跳过 @
- [ ] 伪造/签名错误的 Webhook 请求返回 401，不处理
- [ ] 本地 `npm run dev` 可配合 ngrok 调试端到端流程

---

## Non-Goals（刻意不做）

- 不做 Lark 交互式操作（群内回复、按钮点击触发 GitHub 操作）
- 不做 PR diff / 代码内容展示
- 不做用户自助注册映射关系（配置文件手动维护）
- 不做消息去重（同一事件重复触发发多条，后续可迭代）
- 不做部署自动化（先本地开发，部署方式后定）
- 不支持 GitHub 以外的 Git 平台
- 不通知单条 inline review comment，仅 review submitted

---

## 受影响的组件

新项目，三个核心模块：

| 模块 | 组件 | 职责 |
|------|------|------|
| `webhook` | `WebhookReceiver` | 接收 GitHub Webhook、验证签名、路由事件 |
| `notification` | `NotificationDispatcher` | 将 GitHub 事件转换为 Lark 卡片消息并发送 |
| `config` | `ConfigLoader` | 加载仓库→群映射 + GitHub→Lark 用户映射 |

---

## 模式

fullstack（Node.js/TypeScript 后端服务，无前端界面）

---

## API 交互

**接收（GitHub → 本服务）**

```
POST /webhook
Headers: X-Hub-Signature-256, X-GitHub-Event
Body: GitHub Webhook payload
→ 200 OK / 401 Unauthorized
```

**发出（本服务 → Lark）**

```
POST {lark_webhook_url}
Body: Lark Bot Message Card JSON
→ Lark 标准响应
```

**配置文件结构（config.yaml）**

```yaml
teams:
  - name: frontend
    lark_webhook: "https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
    repositories:
      - owner/repo-a
      - owner/repo-b
    user_mappings:
      github_username_1: "lark_user_id_1"
      github_username_2: "lark_user_id_2"

  - name: backend
    lark_webhook: "https://open.feishu.cn/open-apis/bot/v2/hook/yyy"
    repositories:
      - owner/repo-c
    user_mappings:
      github_username_3: "lark_user_id_3"
```

---

## 故障旅程

| 故障场景 | 处理策略 |
|----------|----------|
| Lark Webhook 超时/5xx | 记录错误日志，返回 200 给 GitHub（避免重试风暴） |
| GitHub 签名验证失败 | 返回 401，记录 warn 日志 |
| 仓库不在配置中 | 静默丢弃，debug 日志 |
| 用户映射缺失 | 消息正常发出，跳过 @ |
| config.yaml 解析失败 | 服务启动失败，打印错误退出 |

---

## 产品地图更新要求

开发完成后，建议运行 `/origin` 初始化产品地图，创建：

- [ ] `docs/product/PRODUCT-MAP.md`
- [ ] `docs/product/modules/webhook/WebhookReceiver.md`（完整级）
- [ ] `docs/product/modules/notification/NotificationDispatcher.md`（完整级）
- [ ] `docs/product/modules/config/ConfigLoader.md`（标准级）

---

## 治理合规

### PD 边界定义

- 安全护栏：Webhook Secret 签名验证（HMAC-SHA256）
- 度量目标：PD 未定义
- 性能约束：PD 未定义（单服务低频触发，无高并发压力）
- A11y 要求：不适用（无前端界面）

### 研发补充（基于代码上下文）

- 风险点：config.yaml 含 Lark Webhook URL（敏感），需加入 `.gitignore`，提供 `config.example.yaml`
- 建议补充：GitHub Webhook Secret 也不应硬编码，建议通过环境变量注入（`GITHUB_WEBHOOK_SECRET`）

---

## Open Issues

无。

---

## Baseline

> 以下文件的内容哈希记录了起草本需求时的产品状态。

| 文件 | SHA256 前 8 位 |
|------|----------------|
| docs/product/PRODUCT-MAP.md | N/A |
| docs/product/modules/notification/index.md | N/A |
| docs/product/modules/notification/NotificationDispatcher.md | N/A |

---

## 实现追溯

### 代码变更

- `src/types/index.ts` — 新增：共享类型定义（Config/GitHub Webhook/Lark Card/常量）
- `src/config/configLoader.ts` — 新增：ConfigLoader 类，启动时构建仓库索引，INV-02 重复校验
- `src/notification/notificationDispatcher.ts` — 新增：NotificationDispatcher 类，6 种事件→卡片颜色映射，INV-03 错误隔离
- `src/webhook/webhookReceiver.ts` — 新增：WebhookReceiver 静态方法，HMAC-SHA256 + timingSafeEqual
- `src/index.ts` — 新增：createApp 工厂函数（测试友好），生产启动入口含 yaml 加载和 env 校验
- `.gitignore` — 新增：排除 config.yaml 防止密钥泄露
- `config.example.yaml` — 新增：配置模板

### 架构决策记录（ADR）

**决策**：`createApp` 接受注入的 `dispatchOverride` 函数，而非直接实例化 NotificationDispatcher  
**考虑过的替代方案**：vi.mock 整个模块；使用依赖注入容器  
**理由**：最小化测试所需的 mock 范围，不需要模块级 mock；工厂函数模式在 Express 中已成熟  
**权衡**：+测试隔离性好；-生产代码暴露了一个测试用参数

**决策**：签名验证使用 `timingSafeEqual` 而非字符串比对  
**考虑过的替代方案**：`signature === expected`（字符串比较）  
**理由**：字符串比较存在时序侧信道攻击风险，攻击者可通过响应时间推断部分 HMAC 字节  
**权衡**：+安全性；-需要等长 Buffer，需 try/catch 处理长度不匹配

**决策**：Lark 消息发送错误在 dispatcher 层捕获而非在 webhook handler 层  
**考虑过的替代方案**：在 webhook handler 中 try/catch  
**理由**：INV-03 要求发送失败不影响 200 响应，dispatcher 本身是发送的执行者，应自行承担错误处理  
**权衡**：+责任清晰；-错误不会被调用方感知（符合 INV-03 设计意图）

### 迭代统计

- Coder 迭代次数：1 次
- 审计得分：83/100
- 新增技术债：3 项（枚举使用、结构化日志、消息去重）
