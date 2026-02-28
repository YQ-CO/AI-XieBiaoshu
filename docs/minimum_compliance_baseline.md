# 最小合规落地基线（MVP）

## 1. 目标与范围

本基线用于当前版本的“可执行最小合规”落地，优先覆盖：
- 密钥管理
- 权限策略
- 审计留存
- 风险控制

适用范围：`backend/src/routes/*` 与后台管理接口。

---

## 2. 密钥管理（最小可执行）

### 2.1 管理原则
- 生产环境默认**不持久化模型 API Key**（`ALLOW_PERSIST_MODEL_API_KEY=false`）。
- 模型密钥优先从环境变量读取（如 `MODEL_API_KEY` / `DEEPSEEK_API_KEY`）。
- 配置读取接口返回密钥时必须脱敏。

### 2.2 当前实现点
- `GET /admin/config`：返回脱敏后的 `model.apiKey`。
- `POST /admin/config`：在默认策略下忽略并移除 `model.apiKey` 持久化。
- 审计记录中禁止写入明文密钥。

### 2.3 环境变量
- `ALLOW_PERSIST_MODEL_API_KEY`：是否允许在配置中持久化模型密钥（默认 `false`）。

---

## 3. 权限策略（RBAC 最小矩阵）

| 资源 | 动作 | 平台管理员 | 企业管理员 | 普通用户 |
|---|---|---:|---:|---:|
| 模型配置 | 查看/更新 | ✅ | ❌ | ❌ |
| 模型调用 | 生成内容 | ❌ | ✅（用户身份） | ✅ |
| 发票审核（专票） | 审核通过/驳回 | ✅ | ❌ | ❌ |
| 订单查看 | 全量/按企业筛选 | ✅ | 仅本企业 | ❌ |
| 审计日志 | 查询 | ✅ | ❌ | ❌ |

说明：企业管理员能力受 `x-enterprise-id` 范围约束。

## 3.1 账号生命周期（P0）

- 平台管理员可执行账号禁用/解封：
	- `POST /admin/users/disable`
	- `POST /admin/users/enable`
- 平台管理员可查询账号状态：
	- `GET /admin/users`
- 全局拦截策略：
	- 被禁用账号登录返回 `403 account disabled`
	- 被禁用账号历史 token 访问受保护接口返回 `403 account disabled`

---

## 4. 审计留存策略

### 4.1 字段规范
审计字段至少包含：
- 操作类型（`category/action`）
- 操作人（`actorType/actorId`）
- 企业范围（`enterpriseId`）
- 结果（`success/message`）
- 时间（`createdAt`）
- 来源（`ip/userAgent`）

### 4.2 留存规则
- 留存天数：`AUDIT_RETENTION_DAYS`（默认 180 天）。
- 最大条数：`AUDIT_MAX_LOGS`（默认 5000）。
- 超过策略自动裁剪（按时间和条数双重裁剪）。

### 4.3 可视化
- `GET /admin/audit-logs` 返回 `policy` 字段，展示当前留存策略。

---

## 5. 风控策略（最小规则）

### 5.1 速率限制（已实现）
- 登录接口 `POST /auth/login`：每分钟最多 20 次（IP + 用户标识维度）。
- 模型生成 `POST /model/generate`：每分钟最多 30 次（用户维度）。
- 敏感管理操作（配置更新/专票审核）：每分钟最多 60 次（管理员维度）。

### 5.2 触发行为
- 命中频控返回 `429`，并设置 `Retry-After`。

---

## 6. 运行与验收清单

### 6.1 配置检查
- [ ] 生产设置 `ALLOW_PERSIST_MODEL_API_KEY=false`
- [ ] 配置 `AUDIT_RETENTION_DAYS` 与 `AUDIT_MAX_LOGS`
- [ ] 生产密钥仅通过环境变量注入

### 6.2 验收脚本建议
- [ ] `GET /admin/config` 不出现明文 key
- [ ] 高频请求登录接口触发 429
- [ ] 高频调用生成接口触发 429
- [ ] 审计接口返回 `policy`

---

## 7. 后续增强（不在本次 MVP）
- 接入 Redis 级别分布式限流
- 审计日志异步入库与归档签名
- 细粒度权限点（动作级策略配置）
- 风险告警通道（Webhook/IM）
