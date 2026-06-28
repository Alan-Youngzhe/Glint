# Glint

面向非技术背景使用者（产品角色）的代码理解 / 学习工具 —— 个人项目。

核心交互：选中任意对象后按 Option 数字键，即在四个维度获得理解（⌥1 为什么这么写 / ⌥2 调用关系 / ⌥3 执行路径 / ⌥4 架构）。

## 快速开始
```bash
pnpm install            # 安装依赖（首次会构建 prisma/sharp）
cp .env.example .env    # 填入 ANTHROPIC_API_KEY / OPENAI_API_KEY / DATABASE_URL
pnpm dev                # http://localhost:3000
```
其他脚本：`pnpm typecheck`、`pnpm build`、`pnpm db:generate`、`pnpm db:migrate`（需 DATABASE_URL）。

验证厂商调用（需已填 Key）：
```bash
curl "http://localhost:3000/api/test?provider=anthropic&prompt=你好"
# 返回 text + usage(token/成本) + 会话累计
```

## 工作区结构
- `app/` — Next.js App Router：页面 `(ui)` 与后端 `api/`
- `components/layout/` — 可停靠布局宿主（Dockview）+ 主题切换
- `lib/ai/` — LLMProvider 抽象（openai/anthropic）+ TaskProfile + 用量记账
- `lib/api/` — data-access 层（mock/real 同接口，`NEXT_PUBLIC_API_MODE` 切换）
- `types/contract.ts` — 前后端契约（唯一接缝）
- `fixtures/` — 前端 mock 数据（形状 = 契约）
- `db/schema.prisma` — 数据模型（Spec §5）
- `styles/tokens.css` — Design System 令牌（暗/浅主题）
- `docs/` — 产品与技术文档（版本管理）
  - `Glint-PRD.md` — 产品需求文档
  - `Glint-技术Spec.md` — 技术规格说明书
  - 施工手册（按工程期次）：`Glint-施工手册.md`（M0–M4 总参考）·`Glint-施工手册-V2.md`（二期）·`Glint-施工手册-V3.md`（三期）·`Glint-施工手册-V4.md`（四期）
  - `design-system/` — 设计系统文档（含 §15 界面规范 + `design/` 设计稿归档）
  - `VERSIONING.md` 版本管理规范 · `CHANGELOG.md` 文档变更记录

## 工程期次（施工手册）
- 一期 ✅ **M0 工程骨架**（本仓库已落代码）
- 二期 **M1 导入浏览 + M2 预理解/架构/技术栈** →《Glint-施工手册-V2.md》
- 三期 **M3 四维交互 + Agent Bar + 轨迹** →《Glint-施工手册-V3.md》
- 四期 **M4 ⌥3 深化 / 泛化检索 / 全量 RAG / 成长分析 / 上线** →《Glint-施工手册-V4.md》
