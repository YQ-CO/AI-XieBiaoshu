# 上线前 Checklist（当前基线）

> 适用范围：标书平台前后端一体仓库（2026-03）

## A. 必过门禁（CI 自动）

- [ ] Frontend `typecheck + unit + build` 通过
  - 工作流：`CI / frontend`
  - 关键命令：`cd frontend && npm run typecheck && npm run test:ci && npm run build`
- [ ] Backend `lint + typecheck` 通过
  - 工作流：`CI / backend-quality`
  - 关键命令：`cd backend && npm run lint && npm run typecheck`
- [ ] Backend `build + unit + integration` 通过
  - 工作流：`CI / backend`
  - 关键命令：`cd backend && npm run build && npm run test:unit && npm run test:integration`
- [ ] 依赖高危漏洞门禁通过
  - 工作流：`CI / backend`
  - 关键命令：`cd backend && npm run security:audit`
- [ ] 密钥泄露扫描通过
  - 工作流：`CI / gitleaks`
- [ ] 代码安全扫描通过（Semgrep 分层）
  - 工作流：`CI / security-semgrep`
  - 观察组：`WARNING/INFO` 只报告
  - 阻断组：`ERROR` 必须通过
- [ ] 文件系统漏洞扫描通过
  - 工作流：`CI / security-trivy`
  - 阻断级别：`HIGH,CRITICAL`

## B. E2E 与性能（按策略执行）

- [ ] Frontend E2E Smoke 已执行并产出报告
  - 工作流：`CI / frontend-e2e-smoke`
  - 当前策略：PR 只报告不阻断；主干阻断
- [ ] 主干性能基线任务通过（或手动触发验收通过）
  - 工作流：`CI / performance`
  - 阈值：`p95 < 1500ms`、`error rate < 1%`
- [ ] 定时性能任务可运行（nightly/weekly）
  - 工作流：`Performance Schedule`

## C. 人工确认（发布前）

- [ ] 关键业务链路抽检通过
  - 登录
  - 充值/订单
  - 发票申请/审核
  - 文档导出（CSV/Word）
- [ ] 权限边界抽检通过
  - 普通用户不可访问 admin 审核与列表接口
- [ ] 环境变量与密钥确认
  - `JWT_SECRET`、管理员令牌、模型 API Key 等已按环境配置
- [ ] 回滚路径已确认
  - 最近稳定版本可回退，回滚步骤可执行

## D. 归档与留痕

- [ ] 本次发布 CI 产物已归档（90 天）
  - `frontend-coverage`
  - `backend-coverage`
  - `playwright-report`
  - `semgrep-report`
  - `trivy-report`
  - `performance-k6*`
- [ ] 发布记录已更新
  - 发布时间、负责人、版本标识、风险项、回滚点

## E. 快速执行清单（本地）

1. `cd backend && npm run lint && npm run typecheck && npm run test:ci && npm run build`
2. `cd frontend && npm run typecheck && npm run test:ci && npm run build`
3. `cd frontend && npm run test:e2e -- --list`
4. （可选）`cd backend && npm run perf:k6`
5. （可选）`cd backend && npm run security:semgrep:observe && npm run security:semgrep:blocking`

---

如需手动性能验收：
- `Actions -> CI -> Run workflow`（可传 `perf_vus`、`perf_duration`）
- `Actions -> Performance Schedule -> Run workflow`（`nightly/weekly/both`）

GitHub 分支保护与一次性流水线验收步骤见：`docs/github_finalization_steps.md`
