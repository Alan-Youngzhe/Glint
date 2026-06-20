# Glint 文档变更记录

记录 PRD / 技术 Spec / Design System 文档的版本演进。

## Design System v0.1 — 2026-06-19
- 新增完整《design-system/Glint-Design-System.md》：暗色优先（Linear 风）+ 浅色两套；电蓝×黑灰、全局唯一强调色；Inter + JetBrains Mono + 像素点阵字；间距/圆角/描边/阴影/运动令牌；Linear 风组件规范；图谱 dagre/ELK 分层布局 + 实心节点（参考 Sourcetrail/Graphite）；可访问性与令牌总表。
- 调性定稿：弃用早先「Bifrost 暖色 Riso」，改为电蓝×黑灰·Linear 风·像素点缀；PRD §5.4 与 Spec §2.1/§8 同步对齐。

## v0.5 — 2026-06-19（当前）
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
