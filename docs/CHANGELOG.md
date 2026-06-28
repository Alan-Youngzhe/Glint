# Glint 文档变更记录

记录 PRD / 技术 Spec / Design System / 施工手册 文档的版本演进。

## 后续期次施工手册（V3 / V4）— 2026-06-20（当前）
- 新增《Glint-施工手册-V3.md》（**三期 M3**：四维交互 + Agent Bar + 轨迹，按设计稿 DS §15 + 一二期代码落地；契约/schema 增量、焦点解析/派发/浮卡/轨迹/UI-action/Agent 伪代码、真实 API、DoD/风险）。
- 新增《Glint-施工手册-V4.md》（**四期 M4**：⌥3 深化 / 泛化检索 / 全量 RAG / 成长分析 / 上线 五模块；契约/schema 增量、各模块步骤与 DoD/风险）。
- **四期施工手册齐备**：一期 M0 已落代码；二/三/四期手册可整套交付下一个 agent 执行。README 增「工程期次」导航。

## 前端设计稿落地 — 2026-06-20
- **设计稿归档** `design-system/design/`（3 张 IDE 主界面图 + 组件特写 + mood board + 可交互原型 `Glint.dc.html`）。
- **Design System v0.2**：新增 §15「界面布局与设计落地」——总体布局、四维用户文案（为什么/谁调用/怎么执行/在哪）、**来源标签 provenance**、⌥1 浮卡 / **INSIGHT 三 Tab 合一** / **底部 TrajectoryBar** / 状态栏规范。
- **施工手册 v0.3**：§3 布局对齐设计稿（TopBar / FocusBar / 维度切换条 / INSIGHT 三 Tab / 底部轨迹条 / StatusBar），修正旧版「⌥2-4 三独立面板 + 轨迹放浮层」。
- **施工手册 V2 v1.1**：二期前端面板对齐设计稿。
- **PRD v0.8**：维度用户文案、INSIGHT 三 Tab、来源标签、底部轨迹条落定；开放问题 #2（轨迹位置）、#3（⌥2-4 面板形态）据设计定案。

## 施工手册 V2（二期）— 2026-06-20
- 新增《Glint-施工手册-V2.md》：二期工程施工手册，承接一期已落地的 M0 代码，覆盖 **M1 导入与浏览 + M2 预理解/架构/技术栈**；含一期现状盘点、契约与 schema 增量、真实 API 翻新顺序、Edge bar/Sidebar 补齐、DoD/风险、三期预告。
- 确立**期次切分**：一期 = M0（已落代码）；二期 = M1+M2（本手册，少依赖设计稿）；三期 = M3 四维交互 + Agent Bar（待设计稿，另出 V3）。
- 一期工程状态记录：仓库已落 Next.js+Dockview 骨架、`types/contract.ts`、`lib/ai`、`lib/api`(mock/real)、`db/schema.prisma`（至 v0.5 级）、`styles/tokens.css`、`fixtures/`、`/api/test`。

## v0.7 — 2026-06-20
- PRD/Spec：新增 **Agent Bar**（开放式探索，P0）——可停靠/可收起面板，能力为「读 + 驱动界面 + 主动建议」；编排 Agent + 工具集 + SSE（token/citation/action/suggestion）；`agent_sessions/agent_messages`、`/api/agent`。
- Spec：加深预生成的 **模块关系推断**（§4.2）——关系骨架来自 `call_edges/import` 确定性聚合，模型只补语义（"把架构-模块关系理解到"的落地）。
- 施工手册升 **v0.2（实现级）**：核心交互（焦点解析 / Option 派发 / 四维渲染 / 浮卡生命周期 / 轨迹状态机 / 钻取 / UI-action 调度器）、预理解管线、技术栈认知、Agent Bar 全展开 + 完整契约类型 + 伪代码。

## v0.6 — 2026-06-20
- PRD：新增 **Edge bar + 可收起侧栏** 导航骨架（§5.5）。
- PRD/Spec：新增「**技术栈认知**」能力——清单/扩展名确定性检测语言/框架/库；逐项解释「是什么 / 用途 / 在整个代码体系中的位置」（全局跨项目缓存、近乎免费）+「在本仓库的角色与关键位置」（预生成），Edge bar 面板 + ⌥4 联动。
- Spec：新增 §4.10、`tech_stack_items` 与全局 `tech_literacy` 表、`/techstack`·`/tech/:slug` API、前端 Edge bar 与技术栈面板。

## Design System v0.1 — 2026-06-20
- 新增完整《design-system/Glint-Design-System.md》：暗色优先（Linear 风）+ 浅色两套；电蓝×黑灰、全局唯一强调色；Inter + JetBrains Mono + 像素点阵字；间距/圆角/描边/阴影/运动令牌；Linear 风组件规范；图谱 dagre/ELK 分层布局 + 实心节点（参考 Sourcetrail/Graphite）；可访问性与令牌总表。
- 调性定稿：弃用早先「Bifrost 暖色 Riso」，改为电蓝×黑灰·Linear 风·像素点缀；PRD §5.4 与 Spec §2.1/§8 同步对齐。

## v0.5 — 2026-06-20
- 产品定名 **Glint**（曾用名：代码理解工具 → Thinkode → Glint）。
- 核心交互改为「选中 + Option 数字键」四维理解：⌥1 为什么这么写 / ⌥2 调用关系 / ⌥3 执行路径 / ⌥4 架构，同一焦点瞬时切换。
- 卡片固定停留 + 收纳成「理解轨迹」标签，取代旧版 Space 钉住。
- 钻取 = 在更细对象上再 Option，不引入第二个键。
- 布局改为 VS Code 式可停靠多面板（Dockview/rc-dock）：⌥1 就近浮卡、⌥2/⌥3 React Flow 面板、⌥4 Treemap 面板。
- 研究依据标注更新为 Gao et al., arXiv:2504.04553v2。

## v0.4 — Thinkode（命名已废弃）
- 引入「Option 悬停即理解 + Space 钉住」核心交互（后被 v0.5 推翻）。
- 整合论文 CodeMap：系统地图、每层预置问题、迭代精修 + 文件名/数量校验。

## v0.3 — Thinkode（命名已废弃）
- 系统地图升为 P0 核心；新增「研究依据」章节。

## v0.1–v0.2 — 代码理解工具（初稿）
- 三层教学式理解（代码/模块/架构）、本地导入、预生成 + 实时解释、数据模型与成长分析雏形。
