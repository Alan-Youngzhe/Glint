# Glint Design System

| 项目 | 内容 |
| --- | --- |
| 版本 | v0.2（新增 §15 界面布局与设计落地，依据设计稿）|
| 状态 | 草稿 · 持续维护 |
| 最后更新 | 2026-06-20 |
| 默认主题 | **暗色优先（Linear 风）**，另附浅色一套 |
| 关联文档 | 《Glint-PRD.md》《Glint-技术Spec.md》 |
| 本期交付 | 文档规范（令牌值内置，便于日后抽成 `tokens.css` 与 `styleguide.html`） |

> 一句话：**近乎单色的黑灰 + 唯一的电蓝强调色，Linear 级的克制与精致，配少量像素/点阵字与像素母题作为"签名人格"。** 颜色优先留给代码本身的语法高亮，UI 框架不抢色。

---

## 1. 设计原则

**① 克制：单色 + 唯一强调色。** 整体近乎单色（黑灰中性），全局只保留**一个**强调色——电蓝（Glint Blue）。UI 框架不该再泼颜色：代码区的**语法高亮本身就是画面里的颜色**，chrome（边栏、面板、卡片、按钮）保持中性，避免和代码抢眼。坚决不要多个高饱和强调色（青+品红那种撞色、四种荧光色）。

**② 低对比分层。** 表面之间靠**极低对比度**区分（背景 → 面板 → 卡片 → 悬浮），而不是靠重边框或重投影。1px 极淡描边 + 微妙顶部高光是主要分层手段（Linear 招牌）。

**③ 留白与密度。** Linear 式：信息密集但有呼吸感。紧凑的控件高度（默认 32px）配合足够的行距与分组间距。

**④ 确定性优先。** 凡是可由代码确定的（文件名、调用关系、节点位置）就用算法决定，不靠模型自由发挥。图谱用真正的布局算法（dagre / ELK），**节点不重叠、当前焦点居中、可数事实可信**。

**⑤ 像素人格，点到为止。** Pascal/点阵字与像素母题（警告三角、像素光标、抖动半调、线框）是 Glint 的"签名"，**小剂量**用于标签、键帽、空状态、品牌时刻；绝不用于正文，绝不破坏专业克制。

**⑥ 四维不靠四色区分。** ⌥1/⌥2/⌥3/⌥4 用**键帽数字 + 图标 + 面板类型**区分，而非给每个维度配一种亮色。强调色始终只有电蓝。

> 别做的事（Anti-patterns）：多个高饱和强调色；霓虹描边的空心框节点；厚重投影；彩虹式数据配色；像素字用于正文；用颜色作为唯一区分手段。

---

## 2. 色彩

### 2.1 原始色阶（Primitives）

**Glint Blue（电蓝 · 唯一强调色）**

| 令牌 | Hex | 用途 |
| --- | --- | --- |
| `--blue-50` | `#EEF1FF` | 极浅底/浅色态 |
| `--blue-100` | `#DBE1FF` |  |
| `--blue-200` | `#B8C4FF` |  |
| `--blue-300` | `#8E9CFF` | 暗底上的蓝色文字/图标 |
| `--blue-400` | `#6175FF` | 暗底强调文字、hover |
| `--blue-500` | `#2E4CFF` | **主强调（填充/按钮/焦点）** |
| `--blue-600` | `#1E39E6` | hover（浅底）/ pressed（暗底） |
| `--blue-700` | `#182EB8` | pressed |
| `--blue-800` | `#16278F` |  |
| `--blue-900` | `#141E5C` | 深底分区 |

**Neutral（黑灰 · 冷调近黑，带极轻蓝底）**

| 令牌 | Hex | | 令牌 | Hex |
| --- | --- | --- | --- | --- |
| `--neutral-950` | `#08090A` | | `--neutral-400` | `#565D67` |
| `--neutral-900` | `#0B0C0E` | | `--neutral-300` | `#79818C` |
| `--neutral-850` | `#0F1113` | | `--neutral-200` | `#A2A9B4` |
| `--neutral-800` | `#141619` | | `--neutral-100` | `#CED3DA` |
| `--neutral-750` | `#191C20` | | `--neutral-50` | `#E9ECF1` |
| `--neutral-700` | `#20242A` | | `--neutral-25` | `#F5F6F8` |
| `--neutral-600` | `#2B3037` | | `--white` | `#FFFFFF` |
| `--neutral-500` | `#3C424B` | | `--black` | `#000000` |

**Semantic（语义色 · 极克制，非品牌色，desaturated）**

| 令牌 | Hex | 仅用于 |
| --- | --- | --- |
| `--success` | `#3FB079` | 成功确认（少量） |
| `--warning` | `#D8A33A` | 警示（呼应像素警告三角） |
| `--danger` | `#E5484D` | 破坏性/错误（呼应复古 "Error/Fail" 弹窗） |
| `--info` | `= --blue-500` | 信息 = 强调蓝 |

> 语义色用得越少越好。多数"状态"用中性 + 图标 + 文案表达；红/绿/琥珀仅在确有必要时出现，且保持低饱和，不与电蓝争夺注意力。

### 2.2 暗色主题映射（默认）

| 语义令牌 | 值 | 说明 |
| --- | --- | --- |
| `--bg` | `#08090A` | 应用背景 |
| `--bg-subtle` | `#0B0C0E` | 次级背景 |
| `--surface` | `#0F1113` | 面板表面 |
| `--surface-elevated` | `#141619` | 卡片/弹层 |
| `--surface-hover` | `#191C20` | 悬停态表面 |
| `--border` | `rgba(255,255,255,0.08)` | 极淡描边（主分层手段） |
| `--border-strong` | `rgba(255,255,255,0.13)` | 强描边/聚焦边 |
| `--highlight-top` | `inset 0 1px 0 rgba(255,255,255,0.04)` | 顶部高光（Linear 招牌） |
| `--text` | `#E9ECF1` | 主文本（非纯白） |
| `--text-secondary` | `#A2A9B4` | 次文本 |
| `--text-tertiary` | `#79818C` | 三级/占位 |
| `--text-disabled` | `#565D67` | 禁用 |
| `--accent` | `#2E4CFF` | 强调填充/焦点 |
| `--accent-hover` | `#4360FF` | 暗底 hover（略提亮） |
| `--accent-pressed` | `#1E39E6` | 按下 |
| `--accent-fg` | `#FFFFFF` | 强调填充上的文字 |
| `--accent-text` | `#8094FF` | 暗底上作"蓝色文字/图标"用（保证可读） |
| `--focus-ring` | `0 0 0 2px rgba(46,76,255,0.55)` | 焦点环 |

### 2.3 浅色主题映射

| 语义令牌 | 值 | 说明 |
| --- | --- | --- |
| `--bg` | `#F3F3F1` | 暖调浅灰底（贴 mood board） |
| `--bg-subtle` | `#ECECEA` |  |
| `--surface` | `#FFFFFF` | 面板/卡片 |
| `--surface-elevated` | `#FFFFFF` | 弹层（靠投影分层） |
| `--surface-hover` | `#F1F2F4` | 悬停 |
| `--border` | `rgba(12,13,15,0.10)` | 极淡描边 |
| `--border-strong` | `rgba(12,13,15,0.16)` | 强描边 |
| `--text` | `#0C0D0F` | 主文本 |
| `--text-secondary` | `#4B5159` | 次文本 |
| `--text-tertiary` | `#767D86` | 三级 |
| `--text-disabled` | `#A2A9B4` | 禁用 |
| `--accent` | `#2E4CFF` | 强调 |
| `--accent-hover` | `#1E39E6` | hover |
| `--accent-pressed` | `#182EB8` | 按下 |
| `--accent-fg` | `#FFFFFF` | 强调上文字 |
| `--accent-text` | `#1E39E6` | 浅底上的蓝色文字 |
| `--focus-ring` | `0 0 0 2px rgba(46,76,255,0.45)` | 焦点环 |

### 2.4 用色规则

强调蓝只用于：主操作按钮、当前/选中态、焦点环、链接、图谱里的"当前焦点节点 / 活动连线"、关键数据强调。**不要**把蓝大面积铺成背景。中性灰承担 95% 的界面。对比度遵守 §11。

---

## 3. 字体（Typography）

### 3.1 字族

| 令牌 | 字体 | 角色 |
| --- | --- | --- |
| `--font-sans` | **Inter**, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif | UI 与正文（Linear 同款） |
| `--font-mono` | **JetBrains Mono**, "SFMono-Regular", Menlo, Consolas, monospace | 代码渲染（CodeMirror） |
| `--font-pixel` | **Departure Mono**, "Silkscreen", monospace | 像素/点阵点缀（人格签名） |

> 字体获取：Inter（rsms.me / Google Fonts）、JetBrains Mono（Google Fonts）、Departure Mono（免费，Helena Zhang；备选 Google Fonts 的 Silkscreen）。像素字仅用于**点缀**：键帽、区块小标题（eyebrow）、维度标签、计数、空状态、品牌时刻。

### 3.2 字阶（Inter；px / 行高 / 字重 / 字距）

| 令牌 | 字号/行高 | 字重 | 字距 | 用途 |
| --- | --- | --- | --- | --- |
| `display` | 32 / 38 | 600 | -0.02em | 大标题/品牌时刻（可改用像素字） |
| `h1` | 26 / 32 | 600 | -0.018em | 页面标题 |
| `h2` | 21 / 28 | 600 | -0.012em | 区块标题 |
| `h3` | 17 / 24 | 600 | -0.008em | 卡片/面板标题 |
| `h4` | 15 / 20 | 600 | 0 | 小标题 |
| `body-lg` | 15 / 23 | 400 | 0 | 阅读型正文 |
| `body` | 14 / 21 | 400 | 0 | **默认 UI 文本** |
| `body-sm` | 13 / 19 | 400 | 0 | 次要说明 |
| `label` | 13 / 16 | 510 | 0 | 控件标签（Inter medium） |
| `caption` | 12 / 16 | 400 | 0 | 注释/元信息 |
| `code` | 13 / 20 | 400 | 0 | 代码（mono） |
| `pixel-label` | 11 / 14 | 400 | +0.04em | 键帽/eyebrow/维度标签（像素字，常大写） |

字重只用 400 / 510(medium) / 600(semibold)。大标题用负字距收紧（Linear 质感）。像素字不加负字距。

---

## 4. 间距与栅格

4px 基准。`--space-0:0 · 0.5:2 · 1:4 · 1.5:6 · 2:8 · 3:12 · 4:16 · 5:20 · 6:24 · 8:32 · 10:40 · 12:48 · 16:64`。

密度偏紧凑（Linear）。控件高度：`sm 28 / md 32（默认）/ lg 36`。卡片内边距 12–16；面板内边距 12；列表行高 32–36。分组间距用 16/24，区块间距 32/48。

---

## 5. 圆角

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--radius-xs` | 4px | 小徽标/标签 |
| `--radius-sm` | 6px | 输入框/小按钮 |
| `--radius-md` | 8px | **默认：卡片/按钮/面板** |
| `--radius-lg` | 12px | 大卡片/弹层 |
| `--radius-xl` | 16px | 模态 |
| `--radius-full` | 9999px | 胶囊/头像 |
| `--radius-pixel` | 0 | **像素母题/键帽（方角，刻意与圆角对比）** |

---

## 6. 描边与高度（Elevation）

分层优先用"极淡描边 + 顶部高光"，投影克制。

**描边：** 1px `--border`；聚焦/选中用 `--border-strong` 或强调边。

**阴影（暗色）：**
`--shadow-1: 0 1px 2px rgba(0,0,0,.40)` · `--shadow-2: 0 4px 12px rgba(0,0,0,.45)` · `--shadow-3: 0 12px 32px rgba(0,0,0,.55)`。弹起表面叠加 `--highlight-top`。

**阴影（浅色）：**
`--shadow-1: 0 1px 2px rgba(16,18,22,.06)` · `--shadow-2: 0 4px 12px rgba(16,18,22,.08)` · `--shadow-3: 0 12px 32px rgba(16,18,22,.12)`。

高度层级：表面(0) → 卡片(1) → 下拉/弹出(2) → 浮卡/模态(3)。**节点卡片用 shadow-1（极轻），不是霓虹描边。**

---

## 7. 运动（Motion）

时长：`--dur-1 80ms`（即时反馈）· `--dur-2 120ms`（hover）· `--dur-3 160ms`（弹层/浮卡）· `--dur-4 240ms`（面板/布局/图谱过渡）。

缓动：`--ease-out: cubic-bezier(.2,0,0,1)`（主用，Linear 质感）· `--ease-in-out: cubic-bezier(.4,0,.2,1)`。

原则：快、轻、不抢戏。⌥ 浮卡淡入 160ms；卡片收纳成轨迹标签用 ~200ms 形变动画；图谱 fit/钻取用 240ms。尊重 `prefers-reduced-motion`（关闭位移/缩放，仅保留淡入）。

---

## 8. 图标与像素母题

**线性图标**：Lucide，描边 1.5px，尺寸 16 / 20 / 24，色用 `--text-secondary`，激活用 `--accent-text`。与 shadcn/ui 一致。

**像素母题（品牌纹理，小剂量）**：警告三角、像素光标/箭头、抖动半调（dither/halftone）、线框（wireframe）、复古 "Error / Fail" 弹窗。方角（radius 0），蓝或黑灰，仅用于：空状态、加载、错误、品牌时刻、维度键帽装饰。来源参考贴图 mood board（电蓝 + 半调/像素）。

---

## 9. 组件规范（Linear 风）

通则：中性表面 + 1px 淡描边 + 极轻投影；强调蓝只点在"主操作/当前态/焦点"。所有交互件有 `default / hover / active / focus-visible / disabled` 五态，focus-visible 一律显示蓝色焦点环。

### 9.1 按钮 Button
- **Primary**：填充 `--accent`，文字 `--accent-fg`，radius-md，高 32；hover `--accent-hover`，active `--accent-pressed`。每屏主操作唯一。
- **Secondary**：`--surface-elevated` + 1px `--border`，文字 `--text`；hover 提到 `--surface-hover`。
- **Ghost**：透明，仅文字/图标，hover 出淡背景。
- **Danger**：仅破坏性操作，用 `--danger`，且二次确认。
- 尺寸 sm28/md32/lg36；图标按钮正方形；禁用降透明并禁指针。

### 9.2 输入 Input / Field
高 32，`--surface` + 1px `--border`，radius-sm/md，占位 `--text-tertiary`；focus：边框转 `--accent` + 焦点环；错误：边框 `--danger`。标签用 `label` 字阶；辅助说明 `caption`。

### 9.3 卡片 Card（核心质感）
`--surface-elevated` + 1px `--border` + `--shadow-1` + `--highlight-top`，radius-md，内边距 12–16。hover（可点时）提到 `--surface-hover` 并微抬 shadow-2，过渡 dur-2。标题 h4 + 次要信息 body-sm/caption。**实心、干净、轻投影**——不要空心霓虹框。

### 9.4 可停靠面板 Dockable Panel
承载文件树 / 代码 / ⌥2 / ⌥3 / ⌥4。结构：面板头（h4 标题 + 维度键帽 + 折叠/拖拽/关闭）+ 面板体。面板头高 36，底部 1px `--border`；可拖拽、分屏、停靠、标签化、收起（Dockview/rc-dock）。面板间用 1px 分隔，不用厚边。

### 9.5 ⌥ 键帽 Keycap（签名元素）
表达 `Option+1/2/3/4`。像素字 `--font-pixel`、方角 `--radius-pixel`、`--surface-elevated` + 1px `--border-strong`，尺寸约 18–20。当前激活维度键帽用 `--accent` 填充 + `--accent-fg`。这是"四维靠键帽区分、不靠四色"的关键载体。

### 9.6 ⌥1 就近浮卡 Floating Card
贴着被选中代码元素弹出（Floating UI 定位），`--surface-elevated` + `--shadow-3` + 1px `--border`，radius-md，最大宽 ~360。头部：像素 eyebrow 标明焦点类型（如 `VARIABLE` / `FUNCTION`）+ 标题。**固定停留**，不悬停即走。带"钉/收纳"按钮。淡入 dur-3。

### 9.7 理解轨迹标签 Trajectory Tab
浮卡在新位置触发时，旧卡形变收缩为标签（dur≈200ms）。标签：胶囊或方角小条，像素字显示焦点名缩写 + 维度键帽小点，`--surface` + 1px `--border`；当前项用 `--accent-text`。点击重新展开为完整浮卡。排布方式（原地"便利贴" vs 顶部/侧边"轨迹条"）见 PRD 开放问题，组件需同时支持。

### 9.8 概念标签 Concept Tag
小徽标，radius-xs，`--surface` + 1px `--border`，文字 `--text-secondary`，可选像素字。用于解释卡片里的知识点（异步/闭包…）。中性为主，不上色。

### 9.9 Tooltip / Popover
深一档表面 + shadow-2/3 + 1px border，caption/ body-sm 字阶；出现延迟 ~300ms，dur-2 淡入。

### 9.10 文件树项 Tree Item
行高 28–32，缩进 16/层，类型图标（Lucide）+ 名称（body-sm）；hover `--surface-hover`，选中 `--surface-hover` + 左侧 2px `--accent` 指示条 + 文字 `--text`。视觉自有，不照搬 VS Code。

### 9.11 代码表面 Code Surface（CodeMirror 主题）
**颜色留给这里**。中性底（`--surface`/`--bg`），行号 `--text-tertiary`，当前行极淡高光，选区 `rgba(46,76,255,.18)`。语法高亮：克制、蓝偏向的有限色板——
- 关键字/控制：`--blue-400`（暗）/`--blue-600`（浅）
- 字符串：`--success`（低饱和）
- 数字/常量：`--accent-text`
- 注释：`--text-tertiary`（斜体）
- 函数/类型：`--text`（靠字重区分）
- 标点/操作符：`--text-secondary`
保持少而有层次，别让代码变彩虹；UI chrome 一律中性，不与代码抢色。

### 9.12 图节点 Graph Node（⌥2/⌥3，核心质感）
**实心卡片**：`--surface-elevated` + 1px `--border` + `--shadow-1`，radius-md，内含图标 + 名称（body-sm）+ 类型像素标签 + 连接端口（清晰小圆点）。状态：
- 当前焦点节点：`--accent` 描边（或淡蓝填充）+ 居中。
- hover/选中：提 `--surface-hover` + `--border-strong`。
- 普通：中性。
**禁止**霓虹空心描边框。质感参考 Graphite / tldraw（圆角、轻投影、清晰端口）。

### 9.13 图连线 Edge
1px–1.5px，普通用 `--border-strong`/`--text-tertiary`，活动/当前路径用 `--accent`。连线**配一句自然语言**标签（body-sm，`--text-secondary`，淡底气泡），即"图管结构、话管意义"。箭头表方向。

### 9.14 图布局 Graph Layout（⌥2 / ⌥3 · 必须）
用真正的 DAG 布局算法（**dagre 或 ELK**），不要力导向乱摆：
- **当前焦点节点居中**；**调用者在上、被调用者在下**（⌥2）；⌥3 执行路径按时序自上而下/泳道排列。
- **节点永不重叠**；层间距、节点间距固定。
- 打开/钻取后 **fit-to-bounds**（自动缩放使全图入视，节点不被切掉）。
- 支持缩放/平移/minimap。
> 品类参考 Sourcetrail（分层、居中、调用者上/被调用者下）——该工具 2021 停更，"Sourcetrail alternative" 仍是高频搜索，正是 Glint 的机会位。

### 9.15 架构 Treemap（⌥4）
嵌套区块版图：区块按 LOC/文件数定大小，**靠中性明度阶**区分层级（不要彩虹分类色）；当前/聚焦区块用 `--accent` 描边或淡蓝。可点击下钻 + fit。标签用 body-sm/caption，过密时仅在 hover 显示。

### 9.16 空 / 加载 / 错误状态
用像素母题表达人格：空状态用像素插画 + 一句话引导；加载用像素进度/抖动；致命错误可用复古 "Error / Fail" 弹窗母题（克制、带幽默），常规错误用 `--danger` + 图标 + 文案。

### 9.17 滚动条
细、半透明、hover 才明显（`rgba(255,255,255,.12)` 暗 / `rgba(0,0,0,.16)` 浅），不占视觉重量。

---

## 10. 数据可视化配色

图谱/Treemap 一律**单色蓝阶 + 中性**，不用分类彩虹：
- 普通元素：中性（`--text-tertiary` / `--border-strong`）。
- 强调/当前/活动：`--accent`。
- 序列/热度：`--blue-100 → --blue-900` 的蓝色渐变阶。
- 仅当必须区分类别且无法用形状/标签时，才引入**极少量**低饱和辅助色，且不得抢过电蓝。

---

## 11. 可访问性

正文对比 ≥ 4.5:1，大字/图形 ≥ 3:1（暗底蓝色文字用 `--accent-text` 而非 `--blue-500`）。focus-visible 必现蓝色焦点环。**不以颜色为唯一信息**：维度靠键帽数字+图标、语义靠图标+文案。命中区 ≥ 32px。尊重 `prefers-reduced-motion` 与 `prefers-color-scheme`。

---

## 12. 令牌总表与 Tailwind 映射

以上 `--blue-*`、`--neutral-*`、语义令牌（`--bg/--surface/--surface-elevated/--border/--text*/--accent*` 等）、`--space-*`、`--radius-*`、`--shadow-*`、`--dur-*`、`--ease-*`、`--font-*` 即完整令牌集。落地建议：

- 在 `:root` 定义暗色（默认），`[data-theme="light"]` 覆盖浅色映射。
- Tailwind：把语义令牌接进 `theme.extend`（`colors.bg/surface/accent…` 指向 `var(--…)`，`borderRadius`、`boxShadow`、`fontFamily`、`transitionTimingFunction` 同理），组件用语义类名而非原始色。
- shadcn/ui：把其 `--background/--foreground/--primary/--border/--ring…` 直接映射到本系统语义令牌，即可获得 Linear 风默认外观。

> 下一步（本期未做）：将本表抽成 `tokens.css`（+ 可选 `tokens.json`），并产出 `styleguide.html` 可视化预览页。

---

## 13. 参考与灵感

| 维度 | 参考 | 取什么 |
| --- | --- | --- |
| 整体调性/配色 | **linear.app** | 近乎单色 + 唯一强调色、低对比分层、留白、克制 |
| 图谱布局/节点摆放 | **Sourcetrail** | 分层 DAG、当前居中、调用者上/被调用者下、不重叠（品类空位=机会） |
| 节点/画布质感 | **graphite.rs / tldraw.com** | 实心圆角节点、极轻投影、清晰端口 |
| 视觉母题 | mood board（电蓝 + 半调/像素/线框） | 像素人格签名、Pascal/终端字符味 |
| 灵感库 | Mobbin / Godly / Land-book（搜 "devtool"、"graph"） | devtool/图谱类界面参考 |

---

## 14. 维护与版本

本设计系统随项目演进，版本记于 `docs/CHANGELOG.md`。命名约定：语义令牌用途化（`--surface-elevated`），原始色阶数字化（`--blue-500`），组件状态五态统一。新增颜色前先问："能不能用中性 + 现有电蓝解决？" 默认答案是能。后续补 `tokens.css` 与 `styleguide.html` 后，三者（文档/令牌/预览）需保持同步。

---

## 15. 界面布局与设计落地（依据设计稿 · 2026-06-20）

> 设计稿归档于 `design/`（3 张主界面图 + 组件特写 + mood board + 可交互原型 `Glint.dc.html`）。本节把设计固化为可施工的布局与组件规范，是界面实现的**唯一视觉依据**；施工手册据此落地。

### 15.1 总体布局

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TopBar  ▲ GLINT  文件 编辑 视图 运行   glint-api / src    选中对象… ⌥1 ⌥2 ⌥3 ⌥4 │
├──┬─────────────┬────────────────────────────────────┬───────────────────────┤
│E │ EXPLORER    │ [orderService.js][orders.js][index] │ ⌥2调用关系│⌥3执行│⌥4架构鸟瞰│
│d │ ▾ glint-api │ FOCUS Lines 7–8  [实时·调AI解释]     │ ┌───────────────────┐ │
│g │  ▾ src      │ ⌥1为什么 ⌥2谁调用 ⌥3怎么执行 ⌥4在哪  │ │ INSIGHT（当前Tab）   │ │
│e │   ▾services │ 7 const session = await getSession │ │ treemap / 图 / 路径  │ │
│  │    orderSvc▮│ ┌─ ⌥1 就近浮卡 ─────────┐           │ │                     │ │
│b │   …         │ │SELECTION 实时·调AI解释 ×│          │ └───────────────────┘ │
│a │             │ │登录态校验 [async][守卫] │          │                       │
│r │             │ │这是什么/逻辑怎么走/位置  │          │                       │
│  │             │ │[跳到 getSession→][⌥2→] │          │                       │
├──┴─────────────┴────────────────────────────────────┴───────────────────────┤
│ TRAJECTORY 轨迹·Drill path  [⌥1 createOrder()×]›[⌥1 Lines11–17×]›[⌥1 7–8]  Clear Esc │
├──────────────────────────────────────────────────────────────────────────────┤
│ ⎇ main   ⊘ 0  ⚠ 0                          Lines 7–8   JavaScript   UTF-8   ▲ Glint │
└──────────────────────────────────────────────────────────────────────────────┘
```

从外到内：① **TopBar** 顶部菜单栏；② 最左 **Edge bar** 竖向图标；③ **EXPLORER** 文件树（可折叠）；④ 中部编辑区 ＝ 文件标签页 + **FOCUS 条** + **维度切换条** + 代码 + **⌥1 浮卡**（覆盖层）；⑤ 右侧 **INSIGHT 面板**（⌥2/⌥3/⌥4 **三 Tab 合一**，非三个独立面板）；⑥ 底部 **TRAJECTORY 轨迹条**；⑦ 最底 **StatusBar**。

### 15.2 四维的用户文案（设计已定）

| 键 | 用户标签 | 面板标题 / 副标题 |
| --- | --- | --- |
| ⌥1 | **为什么** | 选好了，按 ⌥1 看这几行为什么这么写（就近浮卡） |
| ⌥2 | **谁调用** | 调用关系 · 谁调用谁；图管结构，话管意义——每条线配一句解释 |
| ⌥3 | **怎么执行** | 执行路径 · 一件事依次怎么发生——跨层故事线（泳道，含「循环 × items」） |
| ⌥4 | **在哪** | 架构鸟瞰 · 项目版图；分几块、各部分多大——点区块下钻看角色 |

四维**不靠四色区分**，靠键帽数字 + 文字标签 + 面板类型（呼应 §1⑥）。

### 15.3 来源标签 Provenance（重要设计决策）

每张 ⌥1 卡与 FOCUS 条都显式标注**这条理解从哪来**，作为给小白的信任与成本信号：

| 来源短语 | 对应焦点 / 分层（Spec §4.3） |
| --- | --- |
| 实时 · 调 AI 解释 | 选中代码（realtime） |
| 预生成 · 库内直读 | 文件 / 模块（瞬时、≈0 成本） |
| AST · 确定 | 变量（静态分析） |
| 懒生成 · 已缓存 | 函数 / 类（首次后直读） |

样式：像素 eyebrow（`pixel-label`）+ 短语，中性低调，不抢色。

### 15.4 ⌥1 就近浮卡 FloatingCard

- **头**：来源徽标 `SELECTION`/`FILE`/`VARIABLE`/`FUNCTION`（像素方角）+ provenance 短语 + `×`。
- **标题** + **概念标签** chips（如 `async / await`、`守卫语句`）。
- **正文随粒度变**：选中代码 ＝ 三段「这是什么 / 逻辑怎么走 / 在上下文中的位置」（段标题电蓝小字）；文件/模块 ＝ 单段「负责什么」+ 类型 tag（如 `工具`）。
- **底部动作**：`跳到 getSession →`、`⌥2 调用关系 →` 等——点击改焦点 / 开面板（走 §4.7 UI-action 调度器）。
- 固定停留、贴焦点定位；`surface-elevated` + `shadow-3` + 1px border + `radius-md`。

### 15.5 INSIGHT 右面板（⌥2/⌥3/⌥4 三 Tab）

单面板顶部三 Tab（调用关系 / 执行路径 / 架构鸟瞰），切 Tab **不切焦点**。
- **⌥2 调用关系**：节点+连线有向图，连线配一句 NL；当前节点居中、调用者上/被调用者下、不重叠、fit（dagre/ELK）。
- **⌥3 执行路径**：泳道 / 时序，按步骤展开，含「循环 × items」标记，跨层故事线。
- **⌥4 架构鸟瞰**：按顶层目录分列 treemap（app / routes / services / db / middleware / utils），块按 LOC 定大小，**每块带角色 tag**（HTTP / 业务 / 门面 / 模型 / 会话 / 日志 / 业务核心），顶部技术栈**图例 chips**（Node.js / Express / JWT 会话 / 内存 DB），选中块电蓝描边，点块下钻。中性明度阶，不彩虹。

### 15.6 TRAJECTORY 轨迹条（设计已定：底部横条）

- 位于底部、状态栏之上；左标题 `TRAJECTORY 轨迹` + 副 `Drill path · click to jump / 我看过这些地方`。
- chip ＝ 维度键帽（像素字、方角）+ 标签（如 `第 7–8 行`、`createOrder()`）+ `×`；面包屑 `›` 连接；**当前 chip 电蓝填充**。
- 点 chip 跳回该理解；`Clear / Esc` 清空。
- **据此定案 PRD 开放问题**：轨迹收到**底部轨迹条**（强路径感），不是原地便利贴。

### 15.7 TopBar / Edge bar / StatusBar

- **TopBar**：`▲ GLINT` + 文件/编辑/视图/运行 + 居中项目路径 + 右「选中对象，按一个键看懂它」+ 四维键帽（当前维度键帽电蓝）。
- **Edge bar**：竖向图标（Explorer / 搜索 / 调用 λ / 运行 ▷ / 盒子 / 设置 ⚙）；二期入口见 V2，Agent / 轨迹三期。
- **StatusBar**：`⎇ 分支` · `⊘ 错误 ⚠ 警告` · 行号 · 语言 · 编码 · `▲ Glint`。

### 15.8 与令牌的关系

全部用 §2–§12 令牌。电蓝只点在：当前维度键帽、选中代码、active Tab、选中 treemap 块、当前轨迹 chip、主动作按钮、焦点环。其余中性；代码区语法高亮是画面里的主要颜色。

---

## 修订历史

| 版本 | 日期 | 摘要 |
| --- | --- | --- |
| v0.2 | 2026-06-20 | 新增 §15 界面布局与设计落地（依据设计稿）：总体布局、四维用户文案、来源标签、浮卡 / INSIGHT 面板 / 轨迹条 / 状态栏规范；设计稿归档 `design/` |
| v0.1 | 2026-06-20 | 首版设计系统：原则 / 色彩 / 字体 / 间距 / 圆角 / 描边 / 运动 / 组件 / 图谱布局 / 可访问性 / 令牌总表 |

> 版本管理规范见 `../VERSIONING.md`。
