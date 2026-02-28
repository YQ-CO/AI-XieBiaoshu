# GitHub 收尾两项（必做）

> 目标：完成分支保护与一次真实流水线验收。

## 1) 配置分支保护（Required status checks）

在 GitHub 仓库页面执行：

1. 进入 `Settings -> Branches -> Add branch protection rule`
2. Branch name pattern 填：`main`（若使用 `master`，同样配置一条）
3. 勾选：
   - Require a pull request before merging
   - Require status checks to pass before merging
   - Require branches to be up to date before merging
4. 在 required checks 中选择以下 CI job：
   - `Frontend Typecheck + Unit + Build`
   - `Backend Lint + Typecheck`
   - `Backend Build + Tests + Audit`
   - `Secret Scan (Gitleaks)`
   - `Static Scan (Semgrep)`
   - `Filesystem Scan (Trivy)`
   - `Frontend E2E Smoke (Playwright)`（当前 PR 场景是只报告不阻断，是否设为 required 可按团队策略）
5. 保存规则。

说明：`Performance Baseline (k6)` 不建议设为 PR required check，因为它只在主干 push / 手动触发执行。

## 2) 触发一次真实流水线验收（含性能）

### A. 触发 CI 手动验收

1. 进入 `Actions -> CI -> Run workflow`
2. 选择目标分支（建议 `main`）
3. 参数建议：
   - `perf_vus=5`
   - `perf_duration=2m`
4. 运行后确认以下 job 通过：
   - 前后端构建/测试
   - audit/gitleaks/semgrep/trivy
   - performance

### B. 触发性能双节奏工作流验收

1. 进入 `Actions -> Performance Schedule -> Run workflow`
2. 第一次选择 `profile=nightly`
   - `nightly_vus=5`
   - `nightly_duration=10m`
3. 第二次选择 `profile=weekly`
   - `weekly_vus=10`
   - `weekly_duration=15m`
4. 确认 artifacts 已生成：
   - `performance-k6`
   - `performance-k6-nightly`
   - `performance-k6-weekly`

## 验收通过标准

- 主 CI 全绿（含安全扫描）
- performance job 全绿
- artifacts 可下载，且保留策略为 90 天
- PR 到主干时 required checks 能正确阻断失败变更
