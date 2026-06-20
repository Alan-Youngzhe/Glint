# Glint 施工手册（Build Manual）

| 项目 | 内容 |
| --- | --- |
| 版本 | v0.1 |
| 状态 | 可执行 · 随 PRD/Spec 演进 |
| 最后更新 | 2026-06-19 |
| 关联 | 《Glint-PRD.md》《Glint-技术Spec.md》《design-system/Glint-Design-System.md》 |
| 执行者 | 使用者本人 或 AI 编码 agent |

> 这份手册把 PRD/Spec **翻译成可照着跑的施工步骤**。每个阶段给出"做什么 + 关键文件 + 完成标准（DoD）"。设计稿由使用者另行产出，前端实现统一消费 Design System 令牌。

---

## 0. 总策略（先读这一节，决定全局节奏）

**契约优先 → 前端用 mock 先跑通交互 → 后端按同一契约补 → 换 adapter 集成。** 这套顺序保证前后端不冲突。要点：

1. **契约是唯一接缝。** 先把 `/api/understand` 等接口的 TS 类型定死（§9），前后端都依赖它，只有一份定义。
2. **前端先行、用 mock 数据。** Glint 的命脉是交互（Option 数字键、浮卡、轨迹、可停靠面板、图）。用 fixtures 假数据就能把手感和设计跑出来，不必等昂贵的后端（解析/预生成/AI）。
3. **data-access 层收口（§10）。** 所有数据访问走 `lib/api`，mock 与 real 实现同一接口，集成时只切一处。
4. **前端期望必须对齐 Spec §4.3 来源分层。** ⌥1 文件/模块直读、变量走 AST、函数/类懒生成、选中代码实时；⌥2 来自 symbol_refs；⌥4 来自结构。**mock 的数据形状 = 真实形状**，否则集成才发现某维度数据拿不到/太贵——冲突真正藏在这里。
5. **确定性优先。** 图布局用 dagre/ELK（不重叠、当前居中、fit-to-bounds）；结构图用"文件名/数量"校验。可数的事实跑码，不靠模型自判。
6. **视觉克制。** UI 用 Design System 语义令牌（不写裸 hex），唯一强调色电蓝，颜色留给代码语法高亮。

---

## 1. 前置准备

- **运行时**：Node ≥ 20、pnpm（或 npm）。
- **数据库**：PostgreSQL（本地 Docker 或 Neon/Supabase 托管）+ `pgvector` 扩展（P1 才用，先装好）。
- **Key（后端 .env，先单用户）**：`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`DATABASE_URL`。
- **仓库**：已在 `/Users/alanyu/Documents/Code/sideproject/Glint`，git 已初始化。代码建议放仓库根（与 `docs/` 平级）。
- **约定**：见 §11。

---

## 2. 目录结构（建议）

单 Next.js（App Router）应用，前后端同仓共享类型：

```
glint/
├── app/
│   ├── (ui)/                    # 页面：工作台（可停靠布局宿主）
│   └── api/                     # Route Handlers（后端）
│       ├── projects/route.ts
│       ├── understand/route.ts  # 四维理解派发（核心）
│       ├── events/route.ts
│       └── jobs/[id]/stream/route.ts
├── components/
│   ├── layout/                  # Dockview 面板宿主、面板头
│   ├── tree/                    # 文件树
│   ├── code/                    # CodeMirror 封装 + 选区/焦点
│   ├── card/                    # ⌥1 浮卡 + 轨迹标签
│   ├── graph/                   # ⌥2/⌥3 React Flow + dagre 布局
│   ├── treemap/                 # ⌥4
│   └── ui/                      # shadcn 基础件（按 Design System 主题）
├── lib/
│   ├── api/                     # data-access 层：index.ts(接口) + mock/ + real/
│   ├── ai/                      # LLMProvider 抽象（openai/anthropic）
│   ├── parse/                   # tree-sitter：符号/引用/调用
│   ├── pregen/                  # map-reduce 预生成 + 结构迭代校验
│   └── focus/                   # 焦点解析 Focus Resolver
├── types/
│   └── contract.ts              # 前后端契约（唯一接缝，§9）
├── db/
│   └── schema.prisma            # 数据模型（Spec §5）
├── worker/                      # 后台任务消费（索引/预生成/结构/嵌入）
├── fixtures/                    # 前端 mock 数据（形状 = 契约）
├── styles/
│   ├── tokens.css               # 由 Design System §12 抽出
│   └── globals.css
└── docs/                        # PRD / Spec / Design System / 本手册
```

---

## 3. 阶段 M0 · 工程骨架（约 1 周）

**目标**：跑通"调用任一厂商 → 拿结果 → 记 token/成本"，以及一个能拖拽停靠的空壳。

施工：
1. `pnpm create next-app`（TS + App Router + Tailwind）；接入 shadcn/ui。
2. **落地设计令牌**：把 Design System §12 的令牌写成 `styles/tokens.css`（`:root` 暗色默认，`[data-theme="light"]` 覆盖），Tailwind `theme.extend` 指向 `var(--…)`，shadcn 的 `--background/--primary/--border/--ring…` 映射到本系统语义令牌。
3. 集成 **Dockview/rc-dock**，做出可拖拽/分屏/停靠/收起的空面板宿主。
4. Prisma + Postgres，按 Spec §5 建**全部表**（含 `dimension_cache / structure_nodes / interaction_events / 标签三件套`；向量列先空置）。`prisma migrate dev`。
5. **AI 抽象层**（`lib/ai`）：实现 Spec §7 的 `LLMProvider` 接口 + openai/anthropic 两个实现 + TaskProfile 配置 + 用量记账。Key 走后端 `.env`。
6. 写 `types/contract.ts`（§9）骨架，建 `lib/api` 接口 + mock 空实现。

**DoD**：① 一个测试路由能调用任一厂商、返回结果并写下 token/成本；② 空壳能拖动面板、切换暗/浅主题、颜色全部来自令牌。

---

## 4. 阶段 M1 · 导入与浏览（约 1–2 周）

**目标**：上传真实项目，在可停靠布局里浏览/打开/选中代码；符号与调用关系已可查询。

施工：
1. **上传**：前端 `webkitdirectory` 选目录 → 打 zip → `POST /api/projects`；后端解压落地到文件存储。
2. **索引**：遍历建文件索引（语言/大小/行数/哈希/二进制），按 Spec §4.1 过滤（`node_modules`/`.git`/产物/min/超大/二进制）。
3. **符号 + 引用/调用分析**（`lib/parse`，web-tree-sitter）：写 `symbols / symbol_refs / call_edges`。这是 ⌥1 变量级、⌥2、⌥3 的确定性数据源。
4. **文件树面板**（自有视觉，参考 Design System §9.10）+ **代码面板**（CodeMirror 6，只读 + 高亮 + 选区/光标捕获）。

**DoD**：上传一个真实项目，在可拖拽面板里浏览、打开任意文件、选中代码（暂不解释）；`GET /api/symbols/:id/refs` 能返回变量引用、调用边可查。

---

## 5. 阶段 M2 · 预生成 + ⌥4 架构 + 角色卡片 + 调用图数据（约 2–3 周）

**目标**：导入后数分钟内得到架构、模块、各文件/模块角色卡片与可下钻 Treemap；二次打开直接读库。

施工：
1. **后台 Worker + 任务表 + 进度 SSE**（`GET /api/jobs/:id/stream`）。
2. **map-reduce 预生成**（`lib/pregen`）：文件级角色卡片（廉价档 + Batch）→ 模块级 → 架构级（Spec §4.2）。写 `file_summaries / modules / project_analysis`。
3. **结构迭代精修 + 文件名/数量校验**：生成架构结构（供 ⌥4），按 `Accuracy = TP/(TP+FP+FN)` 校验、迭代到收敛（约 3–4 轮）或达上限。写 `structure_nodes / edge_explanations / structure_iterations`。
4. **⌥4 架构 Treemap 面板**（D3/Nivo treemap，中性明度阶分层、可下钻，Design System §9.15）。
5. 增量：按 `content_hash` 判脏只重算受影响项。成本/时长软上限。

**DoD**：导入后数分钟内拿到架构/模块/角色卡片与可下钻 Treemap；二次打开读库不重算；调用图数据（call_edges）就绪。

---

## 6. 阶段 M3 · 选中 + Option 四维交互（核心，约 2–3 周）

**目标**：选中任意对象按 ⌥1/⌥2/⌥4 即得对的那一维理解、四维瞬时切；浮卡固定停留并收纳成轨迹；解释与交互事件入库。**这是主链路收口。**

施工：
1. **焦点解析 Focus Resolver**（`lib/focus`）：把异构目标（代码光标处符号/变量或选区、文件树节点、图节点）统一为 `{focusType, ref, selection?}`。
2. **Option 数字键派发**：全局监听 `Option(Alt)+1/2/3/4` → 组装 `UnderstandRequest` → `POST /api/understand`，按 §4.3 来源分层取数：
   - **⌥1 浮卡**：选中代码实时 SSE 解释（Spec §7.4 结构化）；文件/模块直读；变量走 AST（`symbol_refs` 聚合）；函数/类懒生成缓存（`dimension_cache`）。
   - **⌥2 调用图面板**：`symbol_refs/call_edges` 组图 + 连线 NL（缓存）；**dagre/ELK 分层布局**：当前居中、调用者上/被调用者下、不重叠、fit-to-bounds；**实心节点卡片**（Design System §9.12–9.14）。
   - **⌥4**：直读结构 Treemap（M2 已做，接到派发）。
3. **理解轨迹**：⌥1 浮卡固定停留；新位置触发时旧卡形变收纳为标签；点击标签重展开（Design System §9.6–9.7）。
4. **钻取**：在更细对象再 Option（不引入新键）；面板随焦点联动。
5. **预置问题 / 自动展示**（Spec §4.7）。
6. **记录与事件**：`query_logs` + 概念标签 + `interaction_events`（去抖上报，§9 契约）。
7. **⌥3 执行路径**紧随：`call_edges` trace + LLM 叙述缓存（最复杂，先支持清晰路径、标注"近似"，可顺延 M4 初）。

**DoD**：选中对象按 ⌥1/⌥2/⌥4 即得对应维度、四维可瞬时切；浮卡固定停留并收纳成轨迹；解释与交互事件入库打标签。**至此主链路打通。**

---

## 7. 阶段 M4 · 扩展（主链路稳定后）

⌥3 执行路径深化与精度；泛化检索（分块 + AST 指纹 + pgvector）；全量向量 RAG（自由提问全库检索）；成长分析（物化 `user_concept_stats` + 弱项看板，综合概念标签与交互轨迹）；上线相关（GitHub+OAuth、多用户、前端模型/Key 配置、数据隔离与删除）。详见 Spec §9 M4。

---

## 8. 前后端集成（什么时候、怎么接）

任意阶段，后端某接口实现完成后：在 `lib/api` 把该方法的实现从 mock 切到 real（一个开关，§10）。因为前端一直依赖契约类型，集成 = 换数据源，不改组件。建议顺序：先接 M1 的 tree/file，再 M2 的 architecture/overview，最后 M3 的 understand（⌥1 流式注意 SSE）。

---

## 9. 前后端契约（唯一接缝 · `types/contract.ts`）

> 这是防冲突的核心。前端 mock 与后端实现都实现这套类型。字段与 Spec §6 对齐。

```ts
// ===== Focus =====
export type FocusType =
  | 'folder' | 'file' | 'module' | 'function' | 'class' | 'variable' | 'selection';

export interface Selection {
  fileId: string; startLine: number; startCol: number; endLine: number; endCol: number;
}
export interface Focus {
  type: FocusType;
  ref: string;            // 稳定 id，如 "auth/guard.ts#requireUser" / 文件路径 / 模块 id
  selection?: Selection;  // 仅 type==='selection'
}
export type Dimension = 1 | 2 | 3 | 4;

// ===== Request =====
export interface UnderstandRequest {
  projectId: string; focus: Focus; dimension: Dimension;
}

// ===== ⌥1 卡片 =====
export interface CodeExplanation {     // 选中代码（实时，Spec §7.4）
  language?: string; syntax?: string[];
  lineByLine?: { lines: string; explain: string; why: string }[];
  positionInContext?: string; role?: string;
  concepts?: { slug: string; name: string; confidence: number }[];
  generalization?: { where: string; note: string }[];
}
export interface VariableRefs {        // 变量（AST，确定性）
  definedAt: string; reads: number; writes: number;
  usedBy: { symbol: string; at: string }[];
}
export interface CardPayload {
  kind: 'card';
  focus: Focus;
  title: string;
  summary?: string;                    // file/module/function/class 的角色说明
  explanation?: CodeExplanation;       // selection
  variableRefs?: VariableRefs;         // variable
  source: 'realtime' | 'file_summaries' | 'modules' | 'symbol_card' | 'ast';
  canPin?: boolean;
  drillTo?: { scope: string };
}

// ===== ⌥2 调用图 / ⌥3 执行路径 =====
export interface GraphNode {
  id: string; label: string; kind: 'function'|'class'|'module'|'file'; isFocus?: boolean;
}
export interface GraphEdge {
  from: string; to: string; relation: 'calls'|'imports'|'depends'; nl?: string;
}
export interface CallGraphPayload {
  kind: 'callgraph'; focus: Focus; nodes: GraphNode[]; edges: GraphEdge[]; source: string;
}
export interface ExecStep { order: number; symbol: string; at: string; describe: string; }
export interface ExecPathPayload {
  kind: 'execpath'; focus: Focus; steps: ExecStep[]; note?: string; source: string;
}

// ===== ⌥4 架构 Treemap =====
export interface TreemapNode {
  id: string; name: string; kind: 'dir'|'file'|'module'; loc: number; children?: TreemapNode[];
}
export interface ArchitecturePayload {
  kind: 'architecture'; focus: Focus; root: TreemapNode;
  overview: { summary: string; entryPoints: string[]; readingGuide: string[] };
  techStack: string[];
}

export type UnderstandResponse =
  | CardPayload | CallGraphPayload | ExecPathPayload | ArchitecturePayload;

// ===== 浏览 =====
export interface TreeNode { id: string; name: string; path: string; kind: 'dir'|'file'; children?: TreeNode[]; }
export interface FileContent { content: string; lang: string; }

// ===== 交互事件（成长分析信号） =====
export interface InteractionEvent {
  action: 'select'|'dim1'|'dim2'|'dim3'|'dim4'|'drill'|'recall';
  focusType: FocusType; focusRef: string;
  level?: 'arch'|'module'|'code'; dwellMs?: number; ts: string;
}
```

> ⌥1 选中代码走流式（SSE）：契约上额外提供 `understandStream(req): AsyncIterable<{delta:string}|{done:CardPayload}>`，其余维度走普通 JSON。

---

## 10. data-access 层与 mock 策略（`lib/api`）

```ts
// lib/api/index.ts
export interface GlintApi {
  tree(projectId: string): Promise<TreeNode>;
  file(projectId: string, path: string): Promise<FileContent>;
  understand(req: UnderstandRequest): Promise<UnderstandResponse>;
  understandStream?(req: UnderstandRequest): AsyncIterable<{delta:string}|{done:CardPayload}>;
  architecture(projectId: string): Promise<ArchitecturePayload>;
  logEvents(events: InteractionEvent[]): Promise<void>;
}

// 切换：环境变量 NEXT_PUBLIC_API_MODE = 'mock' | 'real'
export const api: GlintApi =
  process.env.NEXT_PUBLIC_API_MODE === 'real' ? realApi : mockApi;
```

- `lib/api/mock/`：读 `fixtures/` 里的假数据，**形状严格等于契约**。前端全程只 import `api`，不直接 fetch。
- `lib/api/real/`：fetch `/api/*`。后端某接口就绪即切换该方法。
- fixtures 至少覆盖：一个示例项目的 tree、几个文件内容、四个维度各 1–2 个焦点的返回（含一个变量的 `usedBy`、一个 8–12 节点的调用图、一个 treemap）。

---

## 11. 约定（Conventions）

- **样式**：只用 Design System 语义令牌/Tailwind 语义类，**禁止裸 hex**。组件五态齐全（default/hover/active/focus-visible/disabled），focus-visible 必现蓝色焦点环。
- **颜色克制**：唯一强调色电蓝；四维靠键帽数字+图标区分，不配四色；颜色留给代码语法高亮。
- **图**：必须 dagre/ELK 布局 + fit-to-bounds + 节点不重叠；节点实心卡片，禁霓虹空心框。
- **类型**：跨前后端的形状一律从 `types/contract.ts` import，禁止两处各写一份。
- **提交**：Conventional Commits（`feat: / fix: / docs: / chore:`），小步提交。
- **可访问性**：对比 ≥ Design System §11；不以颜色为唯一信息；尊重 reduced-motion。
- **成本**：预生成先在小项目验证成本与收敛轮次，软上限兜底；悬停/触发走直读/AST/缓存，别每次调 AI。

---

## 12. 里程碑验收清单

- [ ] **M0** 厂商调用闭环 + 记账；可停靠空壳 + 令牌主题切换。
- [ ] **M1** 上传/索引/符号·引用·调用；文件树 + 代码面板可浏览选中。
- [ ] **M2** 预生成（卡片/模块/架构）+ 结构迭代校验 + ⌥4 Treemap；增量读库。
- [ ] **M3** 焦点解析 + Option 四维派发；⌥1 浮卡（实时/直读/AST/懒）；⌥2 调用图（dagre 布局+实心节点）；轨迹收纳；记录+事件入库。（⌥3 紧随）
- [ ] **集成** `lib/api` 各方法逐个 mock→real，无需改组件。
- [ ] **主链路打通** = M3 完成。

---

## 13. 施工时最容易踩的坑（重点提醒）

1. **⌥3 执行路径**最复杂（动态语言 trace 不精确）——先出"近似版 + 标注"，别卡主链路。
2. **变量引用**：文件内作用域可靠，跨文件/动态为近似，后续接 LSP 增强。
3. **预生成成本**：大项目 token 量大，先小项目校准，软上限兜底，悬停走直读。
4. **图布局**：不用 dagre/ELK 就会节点重叠/被切——这是 ⌥2/⌥3 能不能用的关键。
5. **前端 mock 形状偏离契约**：集成才暴雷。改契约时前后端同步改 `types/contract.ts`。
6. **UI 抢色**：UI chrome 一旦上多色就和代码语法高亮打架——保持中性 + 单一电蓝。
