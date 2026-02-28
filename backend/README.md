# 标书平台 后端（示例骨架）

这是一个最小可运行的后端骨架，使用 Express + TypeScript，包含基础的登录与 `GET /users/me` 接口，便于快速联调前端。

快速运行（开发模式）：

```bash
cd backend
npm install
cp .env.example .env
# 可选择修改 .env 中的 JWT_SECRET
npm run dev
```

API 示例：
- POST /auth/login  登录（body: { type: 'sms'|'password', mobile, code, username, password })
- GET /users/me     获取当前用户（需 Authorization: Bearer <token>）

说明：本骨架为演示用，生产环境请接入数据库、验证码服务、密码哈希、输入校验与等保安全配置。

## 手动触发性能任务（GitHub Actions）

可在 GitHub Actions 页面手动执行性能基线任务（无需改代码）：

1. 打开仓库 `Actions`，选择 `CI` 工作流。
2. 点击 `Run workflow`。
3. 按需填写参数：
	- `perf_vus`：并发用户数（默认 `5`）
	- `perf_duration`：压测时长（默认 `2m`）
4. 运行完成后在 Artifacts 下载 `performance-k6`，查看 `k6-summary.json` 与后端日志。

补充：`Performance Schedule` 工作流支持夜间轻压与周基准定时任务，也可通过 `workflow_dispatch` 手动触发。

## 本地安全扫描（Semgrep 分层）

在后端目录可直接运行与 CI 对齐的分层扫描命令：

```bash
cd backend
npm run security:semgrep:observe   # WARNING/INFO，仅报告
npm run security:semgrep:blocking  # ERROR，阻断级
```

扫描结果默认输出到仓库根目录：`.reports/semgrep-local/`。