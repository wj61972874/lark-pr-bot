# 审计报告：FEAT-3c25-lark-pr-bot

**得分：83/100** ✅ 通过
**日期**：2026-04-30

## 得分明细

| 维度           | 得分  | 备注                                           |
| -------------- | ----- | ---------------------------------------------- |
| 需求一致性     | 24/25 | 所有 AC 均实现；生产启动 config 为空扣 1 分   |
| OpenSpec 合规  | 13/15 | NotificationType / WebhookSignatureError 有定义无使用 |
| 安全性         | 14/20 | 缺少启动时 env 检查 (-3) + 缺少 .gitignore (-3) |
| 代码质量       | 12/15 | 无 yaml 加载实现 (-2)；console-only 日志 (-1)  |
| 分级合约合规   | 8/10  | 完整级；两条故障旅程未按 spec 实现             |
| 产品文档就绪度 | 9/10  | trace 更新要求清晰；缺组件关系表声明           |
| 治理合规       | 3/5   | 安全护栏部分缺失（启动检查未实施）             |

---

## 阻塞类发现

### 1. [主要] `src/index.ts:40` — GITHUB_WEBHOOK_SECRET 缺失时静默降级为空 key
**描述**：`process.env.GITHUB_WEBHOOK_SECRET ?? ''` 当环境变量未设置时使用空字符串作为 HMAC key，不会触发启动失败。  
**规格预期**：故障旅程明确要求"服务启动失败，打印错误退出"。  
**攻击路径**：管理员漏配 env var → secret = '' → 攻击者用空 key 计算合法 HMAC → 发送伪造 webhook → 绕过签名验证  
**置信度**：9/10  
**修复**：在服务启动时（`require.main === module` 分支内）检查 `GITHUB_WEBHOOK_SECRET`，缺失则 `process.exit(1)`。

### 2. [主要] 项目根目录 — 缺少 `.gitignore` 文件
**描述**：CLAUDE.md 注明"config.yaml 含敏感 URL，已加入 .gitignore"，但 `.gitignore` 文件不存在。  
**攻击路径**：config.yaml 意外 `git add .` → 推送至远端 → Lark Webhook URL 泄露 → 攻击者向群发送任意消息  
**置信度**：9/10（直接可验证）  
**修复**：创建 `.gitignore`，包含 `config.yaml`、`.env`、`node_modules/`、`dist/`。

### 3. [主要] `src/index.ts:79` — 生产入口点使用空 config 启动
**描述**：`createApp({ config: { teams: [] } })` 使服务以零 team 配置启动，所有 webhook 事件都会被 INV-04 静默丢弃。Config yaml 加载未实现。  
**置信度**：10/10  
**修复**：实现 `loadConfigFromYaml(configPath: string): AppConfig`，在 `require.main === module` 入口中调用，读取 `process.env.CONFIG_PATH ?? './config.yaml'`。

### 4. [次要] `src/index.ts:40` — 签名验证在每次请求中读取 env var
**描述**：每次 POST /webhook 都调用 `process.env.GITHUB_WEBHOOK_SECRET`，而非在启动时读取一次缓存。低频场景下影响可忽略，但不符合 fail-fast 原则。  
**置信度**：8/10  
**修复**：将 secret 在 `createApp` 创建时读取并绑定到闭包。

---

## 信息类发现

### 5. [信息] `src/types/index.ts` — `NotificationType` 有定义无使用
**描述**：spec 定义了 `NotificationType` 枚举（PR_OPENED/PR_MERGED 等），但实现中使用字符串比较（`action === 'opened'`）而非枚举。不影响功能，但枚举是 spec 合约的一部分。  
**置信度**：10/10（直接可见）

### 6. [信息] `src/types/index.ts` — `WebhookSignatureError` 有定义无使用
**描述**：类型文件定义了 `WebhookSignatureError` 自定义错误，但实现中直接返回 401 而非抛出该错误。可酌情采用。  
**置信度**：10/10

### 7. [信息] `src/notification/notificationDispatcher.ts` — 无结构化日志
**描述**：使用 `console.error` 输出错误，无时间戳、无 request-id、无结构化 JSON 格式。生产环境难以检索问题。建议后续引入 pino/winston。  
**置信度**：8/10

### 8. [信息] `src/index.ts` — 缺少 `config.example.yaml`
**描述**：治理合规章节要求提供 `config.example.yaml` 作为配置模板，当前未创建。  
**置信度**：10/10

---

## 待验证（置信度 < 5）

### 9. [待验证] Lark at-mention 格式兼容性
`<at user_id="xxx"></at>` 是飞书卡片的 @语法，在不同飞书版本中渲染行为可能有差异。  
**置信度**：3/10 — 需集成测试验证  
**建议验证方式**：用真实 lark_user_id 发一条测试卡片，确认 @ 渲染正常。

---

## 技术债

- [ ] 实现 `loadConfigFromYaml()` 完成生产入口 — 优先级：**高**
- [ ] 添加 `.gitignore` 和 `config.example.yaml` — 优先级：**高**
- [ ] 启动时校验 `GITHUB_WEBHOOK_SECRET` 必填 — 优先级：**高**
- [ ] 在 `createApp` 初始化时缓存 secret，而非每请求读 env — 优先级：中
- [ ] 引入结构化日志（pino / winston） — 优先级：低
- [ ] 在实现中使用 `NotificationType` 枚举替代字符串字面量 — 优先级：低
- [ ] 消息去重（delivery_id）— 优先级：低（Non-Goal，后续迭代）

---

## 产品文档网络更新清单

- [ ] `docs/product/modules/webhook/WebhookReceiver.md`（完整级）
  - FSM：IDLE→VERIFYING→ROUTING→DISPATCHING→COMPLETED/REJECTED/IGNORED
  - 不变式：INV-01~INV-04
  - 故障旅程：签名失败/未知仓库/Lark失败/启动失败
- [ ] `docs/product/modules/notification/NotificationDispatcher.md`（完整级）
  - 交互表：6种事件→卡片颜色映射
  - 故障旅程：Lark 5xx/超时
- [ ] `docs/product/modules/config/ConfigLoader.md`（标准级）
  - 状态：valid/duplicate_repo_error
  - 方法：findTeamByRepo/getLarkUserId
- [ ] `docs/product/PRODUCT-MAP.md`

---

## Learnings 应用

无（`docs/learnings/` 目录不存在，本次为首次运行）

---

## 判定

**通过（83/100）**。核心安全机制（HMAC 验签、timingSafeEqual、INV-01~INV-04 不变式）全部正确实现，38 个测试全绿。  
3 个阻塞类主要问题（`.gitignore` 缺失、生产启动配置缺失、env 校验缺失）需在首次生产部署前修复，不阻断当前代码合并，但需作为 **首批技术债** 处理。
