# Glint 施工手册 V2（二期工程）

| 项目 | 内容 |
| --- | --- |
| 版本 | v1.1（前端面板 / Treemap 对齐设计稿，指向 DS §15） |
| 期次 | **二期**（M1 导入与浏览 + M2 预理解 / 架构 / 技术栈） |
| 状态 | 可执行 · 承接一期已落代码 |
| 最后更新 | 2026-06-20 |
| 关联 | 《Glint-PRD.md》v0.7 ·《Glint-技术Spec.md》v0.6 ·《Glint-施工手册.md》(M0–M4 总参考) ·《design-system/Glint-Design-System.md》 |
| 执行者 | 使用者本人 或 AI 编码 agent |

> 本手册**只管二期**，承接一期已经落地的 M0 骨架，**在现有代码之上往上建，不重写**。文中所有文件路径都是仓库里真实存在或要新建的位置。**二期的前端面板（EXPLORER / 代码 / FocusBar / ⌥4 架构鸟瞰 / 技术栈）按设计稿与 Design System §15 实现**（设计稿归档 `design-system/design/`）。三期（重交互 + Agent Bar）另出 V3。

---

## 0. 期次地图（先对齐节奏）

| 期 | 范围 | 状态 | 依赖 |
| --- | --- | --- | --- |
| **一期** | M0 工程骨架 | ✅ **已落代码** | — |
| **二期** | M1 导入与浏览 + M2 预理解/架构/技术栈 | ▶ **本手册** | 一期代码 |
| **三期** | M3 选中+Option 四维交互 + Agent Bar + 理解轨迹 | ⏳ 待设计稿，另出 V3 | 二期 + 设计稿 |

二期为什么这样切：M1+M2 是**数据与"框架感"层**（上传 → 解析 → 预理解 → 架构鸟瞰 + 技术栈），主要是后端/数据 + 基础 UI（文件树、代码、Treemap），**少依赖设计稿**，能立刻接着一期开工；把重交互（⌥ 浮卡/图、轨迹、Agent Bar，视觉个性最重）整体留给配设计稿的三期。

---

## 1. 一期现状盘点（V2 在此之上建）

一期已落地的，二期**直接复用，不要重建**：

| 已有 | 位置 | 二期怎么用 |
| --- | --- | --- |
| 前后端契约（四维核心） | `types/contract.ts` | 已含 Focus/Dimension/UnderstandRequest、Card/CallGraph/ExecPath/Architecture Payload、TreeNode/FileContent、InteractionEvent、UnderstandStreamChunk。二期**追加** Tech Stack 类型（§3） |
| data-access 接口 | `lib/api/index.ts`（`GlintApi`：tree/file/understand/understandStream/architecture/logEvents） | 二期**追加** `techstack()`/`tech()`，并把 tree/file/architecture/techstack 的 `real` 实现逐个接通 |
| mock 与 fixtures | `lib/api/mock/`、`fixtures/{tree,understand,architecture}.ts` | 前端先吃 mock；新增 `fixtures/techstack.ts` |
| AI 抽象层 | `lib/ai/`（provider/profiles/pricing/usage/index） | 预理解、技术栈认知直接调它，按 TaskProfile 选档 |
| 数据模型 | `db/schema.prisma` | 已建 File/Symbol/SymbolRef/CallEdge/FileSummary/Module/ProjectAnalysis/StructureNode/EdgeExplanation/StructureIteration/DimensionCache/Job 等（v0.5 级）。二期**追加** `tech_stack_items`/`tech_literacy`（§3） |
| 可停靠壳 + 主题 | `components/layout/{DockShell,Workbench,ThemeToggle}.tsx` | 二期在其上加 EdgeBar/Sidebar 与各面板（§7） |
| 令牌 | `styles/tokens.css` | 所有新 UI 只用语义令牌 |
| 厂商验证 | `app/api/test/route.ts` | 参考其写法实现真实 `app/api/*` 路由 |

**缺口（二期补）**：`lib/parse`（tree-sitter）、`lib/pregen`（预理解管线）、`lib/techstack`、`components/{tree,code,treemap,techstack}`、`worker/`、真实 `app/api/{projects,tree,file,architecture,techstack,tech,jobs}` 路由、schema 的 tech 两表、契约的 tech 两型。

---

## 2. 二期目标与完成标准（DoD）

**一句话**：上传一个真实本地项目 → 在可停靠布局里浏览文件树与代码 → 后台自动预理解 → 看到**架构鸟瞰 Treemap**（模块/关系/规模）+ **技术栈面板**（语言/框架/库 + 认知卡片）——即"打开就有框架感"。

二期完成 ＝ 同时满足：
1. 能上传本地文件夹，`files` 入库，过滤生效。
2. tree-sitter 解析出 `symbols`/`symbol_refs`/`call_edges`，可查询。
3. 文件树面板 + 代码面板（CodeMirror）可浏览、可选中（选中先不触发解释，那是三期）。
4. 后台预理解跑通：文件摘要 → **模块聚类 + 关系推断** → 架构合成 → 结构迭代校验，结果入库。
5. ⌥4 架构 Treemap 面板渲染（可下钻），技术栈面板列出技术项 + 认知卡片。
6. `lib/api` 的 `tree`/`file`/`architecture`/`techstack` 已从 mock 切到 real。
7. 二次打开项目直接读库，不重算。

> 注意：二期的架构 Treemap 与技术栈是**可浏览的面板**（从 Sidebar/Dock 打开），还**不接** Option 键手势——"选中 + ⌥4"的手势接线在三期（焦点解析 + 派发）。

---

## 3. 契约与 schema 增量（二期要加的）

### 3.1 契约（`types/contract.ts` 追加）
```ts
// ===== 技术栈（二期）=====
export interface TechItem {
  slug: string; name: string;
  kind: "language" | "framework" | "library" | "tool" | "datastore";
  version?: string;
  role?: string;                    // 在本仓库的角色
  usageRefs?: { at: string }[];     // 使用处（可跳转）
}
export interface TechLiteracy {     // 项目无关的通用认知（全局缓存）
  slug: string; name: string;
  what: string; purpose: string; ecosystemPosition: string;
}
```
并在 `GlintApi`（`lib/api/index.ts`）追加：
```ts
techstack(projectId: string): Promise<TechItem[]>;
tech(slug: string): Promise<TechLiteracy>;
```
> Agent / UIAction 等类型属三期，二期**先不加**，保持契约干净。

### 3.2 数据模型（`db/schema.prisma` 追加）
```prisma
enum TechKind { language framework library tool datastore }

model TechStackItem {
  id           String   @id @default(cuid())
  projectId    String   @map("project_id")
  kind         TechKind
  name         String
  slug         String
  version      String?
  detectedFrom Json?    @map("detected_from")  // package.json / 扩展名 等来源
  usageRefs    Json?    @map("usage_refs")
  role         String?
  createdAt    DateTime @default(now()) @map("created_at")
  @@index([projectId])
  @@map("tech_stack_items")
}

model TechLiteracy {                            // 全局（非按项目），跨项目复用
  slug             String   @id
  kind             String
  name             String
  what             String
  purpose          String
  ecosystemPosition String  @map("ecosystem_position")
  aliases          Json?
  model            String?
  createdAt        DateTime @default(now()) @map("created_at")
  @@map("tech_literacy")
}
```
`pnpm db:migrate` 生效。Job 的 `JobType` 已含 `index/symbol/pregen/structure`，二期够用。

---

## 4. M1 · 导入与浏览

### 4.1 上传与索引（`app/api/projects/route.ts` + `lib/import`）
- 前端 `webkitdirectory` 选目录或拖拽 → 打包 zip → `POST /api/projects`（multipart）。
- 后端解压落地到文件存储（本地 MVP 可落 `storageRef` 指向的临时目录）；遍历建 `files`：`relPath/lang/sizeBytes/loc/contentHash/isBinary`。
- **过滤**：跳过 `node_modules`、`.git`、`dist/build/out`、`vendor`、锁文件、min/压缩、>512KB、二进制。
- 写 `Project`（`sourceType=local`，`status`）→ 投递 `Job(type=index→symbol→pregen→structure)` → 返回 `{project, jobId}`。

### 4.2 符号 / 引用 / 调用（`lib/parse`，web-tree-sitter）
- 加依赖：`web-tree-sitter` + 各语言 wasm grammar（先 TS/JS/Python）。
- 解析每个源文件 → `Symbol`（function/class/method/variable + 位置/签名）。
- 解析引用与调用 → `SymbolRef`（read/write/call/def）；按 call 聚合写 `CallEdge`（caller→callee + refCount）。
- 解析 import/require → 文件级依赖边（供 §5.2 模块关系）。
- **全部确定性**，是 ⌥1 变量级、⌥2 调用图、⌥3 trace（三期）与模块关系（二期）的地基。

### 4.3 文件树面板（`components/tree/FileTreePanel.tsx`）
- 消费 `api.tree(projectId)`（`GlintApi.tree` 已在，先吃 `fixtures/tree.ts`）。
- 自研、视觉自有（Design System §9.10）：展开/折叠、缩进、类型图标（lucide）、当前高亮、键盘导航；每个节点带稳定 `Focus`（`file`/`folder`），为三期 Option 手势预留。
- 作为一个 Dockview 面板 + Sidebar「文件树」入口。

### 4.4 代码面板（`components/code/CodePanel.tsx`，CodeMirror 6）
- 加依赖：`codemirror` + `@codemirror/*`（lang-javascript/python…）。
- 消费 `api.file(projectId, path)`；只读 + 语法高亮 + 选区/光标捕获（捕获先存 store，**暂不派发**——派发是三期）。
- 主题用 `styles/tokens.css`（CodeMirror 自定义主题映射到令牌，Design System §9.11）。

**M1 DoD**：上传真实项目 → 文件树浏览/打开文件 → 代码高亮可读、可选中；`symbols/symbol_refs/call_edges` 已入库可查（加一个临时 `GET /api/symbols?file=` 自测即可）。

---

## 5. M2 · 预理解 + 架构 + 技术栈

### 5.1 后台 Worker（`worker/index.ts`）
- 长驻消费 `Job` 表（MVP 进程内循环即可）：按 `type` 依次跑 index→symbol→pregen→structure；更新 `progress/status`。
- 进度经 `GET /api/jobs/[id]/stream`（SSE）推前端（参考 `app/api/test` 写法）。

### 5.2 预理解管线（`lib/pregen`，核心）
照《Glint-施工手册.md》§5 的伪代码落地，落到现有 model：
1. **文件级摘要（Map）**：`profiles.file_card`（廉价档 + Batch）→ 写 `FileSummary`（summary/role/calls/calledBy/keySymbols）。
2. **模块聚类 + 关系推断**：按目录/包 + `CallEdge`/import 聚类 → 把符号级调用/依赖**向上汇聚成模块间关系**（depends-on、数据流、入口；**确定性**）→ 在关系骨架上用 `profiles.module_arch` 补 `responsibility/businessRole/为什么这样组织/关系一句话` → 写 `Module`（`dependsOn`/`isEntry`）+ `EdgeExplanation`。这步就是"把架构-模块关系理解到"。
3. **架构合成**：只读摘要 → 写 `ProjectAnalysis`（architectureOverview/techStack/frameworks）。
4. **结构迭代校验**：`profiles.structure_gen` 产结构 → 用 `files` 做 `Accuracy=TP/(TP+FP+FN)` 校验 → 漏/错喂回下一轮（≤5 轮，收敛即停）→ 每轮写 `StructureIteration`，结果写 `StructureNode`。
- 增量：按 `contentHash` 判脏只重算受影响项。成本走廉价档 + Batch + 软上限。

### 5.3 ⌥4 架构 Treemap 面板（`components/treemap/ArchPanel.tsx`）
- 消费 `api.architecture(projectId)`（`GlintApi.architecture` 已在；先吃 `fixtures/architecture.ts`，real 时由 `StructureNode` 组 `TreemapNode` + `ProjectAnalysis.overview`）。
- D3 treemap 或 Nivo treemap：**中性明度阶分层**（不彩虹）、当前/聚焦区块电蓝描边、可点击下钻 + fit（Design System §9.15）。
- 作为 Dockview 面板，导入完成默认打开（"打开就有框架感"）。

### 5.4 技术栈检测与认知（`lib/techstack`）
1. **检测（确定性）**：解析 `package.json`/`requirements.txt`/`go.mod`/扩展名/配置 → 写 `TechStackItem`。不靠模型。
2. **通用认知（全局缓存）**：`tech(slug)` 命中 `TechLiteracy` 直读；未命中调一次廉价模型生成「是什么/用途/生态位置」并写回——**跨项目复用、近乎免费**。
3. **本仓库角色/使用处**：从 `ProjectAnalysis` + `SymbolRef`（哪里 import/用）算 `role`/`usageRefs`。

### 5.5 技术栈面板（`components/techstack/TechStackPanel.tsx`）
- Edge bar「技术栈」入口；列 `api.techstack()`，分组（语言/框架/库…）；点开取 `api.tech(slug)` + 本仓库角色/使用处；点"使用处"切焦点（为三期 ⌥2/⌥4 联动预留）。

**M2 DoD**：导入后数分钟内得到模块（含关系）/架构/结构；架构 Treemap 可下钻；技术栈面板列项 + 认知卡片；二次打开读库不重算。

---

## 6. 真实 API 路由（逐个把 `lib/api/real` 从 mock 翻过来）

| 方法 | 路由（新建） | 回填的 GlintApi 方法 | 数据来源 |
| --- | --- | --- | --- |
| POST | `/api/projects` | （上传，返回 project+jobId） | 解压 + `files` |
| GET | `/api/jobs/[id]/stream` | （SSE 进度） | `Job` |
| GET | `/api/projects/[id]/tree` | `tree` | `files` |
| GET | `/api/projects/[id]/files?path=` | `file` | 文件存储 |
| GET | `/api/projects/[id]/architecture` | `architecture` | `StructureNode`+`ProjectAnalysis` |
| GET | `/api/projects/[id]/techstack` | `techstack` | `TechStackItem` |
| GET | `/api/tech/[slug]` | `tech` | `TechLiteracy`（全局） |

**翻新顺序**：tree → file → architecture → techstack/tech。每接通一个，就把 `lib/api/real` 对应方法从"回退 mock"改为真实 fetch；前端组件不动（仍 import `api`）。`understand`/`understandStream`/`logEvents` 留三期（保持 mock）。

---

## 7. Edge bar / Sidebar（导航骨架补齐）

在现有 `components/layout/{DockShell,Workbench}.tsx` 之上加：
- `components/shell/EdgeBar.tsx`：最左竖向图标栏。二期入口：**项目切换、文件树、搜索、技术栈、设置**（Agent、理解轨迹留三期占位）。
- `components/shell/Sidebar.tsx`：点 Edge 图标展开/收起对应面板，可整体收起。
- 中部 Dock 区放：代码面板、架构 Treemap 面板（⌥2/⌥3 图面板留三期）。
- 视觉按 **Design System §15**（设计稿已到位，归档 `design-system/design/`）：EXPLORER / FocusBar(含来源标签) / 维度切换条 / INSIGHT 三 Tab / 底部轨迹条 / 状态栏。二期实现前四项与 ⌥4，⌥1–⌥3 手势与轨迹联动留三期。

---

## 8. 二期验收清单

- [ ] 上传本地项目 → `files` 入库 + 过滤生效。
- [ ] tree-sitter → `symbols`/`symbol_refs`/`call_edges` 可查。
- [ ] 文件树面板 + 代码面板（CodeMirror）可浏览/选中。
- [ ] Worker 跑通预理解：文件摘要 / **模块关系** / 架构 / 结构校验入库。
- [ ] 架构 Treemap 面板可下钻；技术栈面板列项 + 认知卡片。
- [ ] `lib/api` 的 tree/file/architecture/techstack 已 mock→real。
- [ ] 契约加 TechItem/TechLiteracy；schema 加 tech 两表并迁移。
- [ ] 二次打开读库不重算。

## 9. 二期风险

| 风险 | 应对 |
| --- | --- |
| tree-sitter 语法覆盖 | 先 TS/JS/Python；无 grammar 的语言降级（仅文件树+摘要，跳过符号级） |
| 模块关系被模型瞎编 | 关系骨架必须来自 `CallEdge`/import 确定性聚合，模型只翻译成人话（§5.2） |
| 预理解成本/时长 | 先小项目校准轮次与成本；廉价档 + Batch + 软上限；增量按 hash |
| 结构 Treemap 大项目过密 | 按模块分层下钻 + fit；标签 hover 才显 |
| 视觉未定 | 二期 UI 走令牌占位，设计稿到位再细化；不阻塞功能 |

---

## 10. 三期预告（需设计稿，另出 V3）

三期 = **M3 选中 + Option 四维交互 + Agent Bar**：焦点解析 + Option 数字键派发、⌥1 就近浮卡（实时/直读/AST/懒）、⌥2/⌥3 图面板（dagre 布局，复用二期的 `CallEdge` 数据）、理解轨迹状态机、钻取、UI-action 调度器；Agent Bar（编排 + 工具 + 流式 + 驱动界面 + 建议）。届时契约加 `UIAction`/Agent 事件类型，schema 加 `agent_sessions/agent_messages`，并把 `understand`/`agent` 的 real 接通。**重交互视觉个性最强，等设计稿到位再开工**——这正是把它单独划为三期的原因。实现伪代码已在《Glint-施工手册.md》§4 与 §7，V3 会落到具体代码。

---

## 修订历史

| 版本 | 日期 | 摘要 |
| --- | --- | --- |
| v1.1 | 2026-06-20 | 前端面板对齐设计稿：EXPLORER / FocusBar(来源标签) / ⌥4 架构鸟瞰 / 技术栈 按 Design System §15；指向归档设计稿 |
| v1.0 | 2026-06-20 | 二期施工手册首版：承接一期 M0 代码，覆盖 M1 导入浏览 + M2 预理解/架构/技术栈；契约与 schema 增量、真实 API 翻新顺序、DoD/风险、三期预告 |

> 版本管理规范见 `VERSIONING.md`。
