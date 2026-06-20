# Glint 施工手册（Build Manual）

| 项目 | 内容 |
| --- | --- |
| 版本 | v0.2（实现级：核心交互 / 预理解管线 / 技术栈认知 / Agent Bar 全展开） |
| 状态 | 可执行 · 随 PRD/Spec 演进 |
| 最后更新 | 2026-06-20 |
| 关联 | 《Glint-PRD.md》v0.7 ·《Glint-技术Spec.md》v0.6 ·《design-system/Glint-Design-System.md》 |
| 执行者 | 使用者本人 或 AI 编码 agent |

> 本手册把 PRD/Spec **翻成可直接照着写代码的施工图**：给状态模型、组件树、关键伪代码、完整契约。设计稿由使用者另出，前端统一消费 Design System 令牌。

---

## 0. 总策略（先读，决定全局节奏）

**契约优先 → 前端用 mock 跑通交互 → 后端按同一契约补 → 换 adapter 集成。**

1. **契约是唯一接缝**：先定 `types/contract.ts`（§8），前后端都依赖它。
2. **前端先行、用 mock**：Glint 命脉是交互（Option 四维、浮卡、轨迹、可停靠面板、图、Agent Bar）。用 `fixtures/` 假数据就能把手感、设计、Agent 全跑出来。
3. **data-access 收口**（§9）：所有取数走 `lib/api`，mock↔real 一处切换。
4. **前端期望对齐 Spec §4.3 来源分层**：mock 形状 = 真实形状，否则集成才暴雷。
5. **确定性优先**：符号/调用/模块关系/技术栈检测都来自 AST 与清单（可数事实），模型只补语义；图布局用 dagre/ELK；结构用文件名/数量校验。
6. **视觉克制**：只用 Design System 语义令牌；唯一强调色电蓝；颜色留给代码语法高亮。

---

## 1. 前置准备

- Node ≥ 20、pnpm；PostgreSQL（本地 Docker 或 Neon/Supabase）+ `pgvector`（P1 用，先装）。
- 后端 `.env`：`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`DATABASE_URL`、`NEXT_PUBLIC_API_MODE=mock|real`。
- 仓库已在 `/Glint`，git 已初始化；代码放仓库根（与 `docs/` 平级）。

---

## 2. 目录结构

```
glint/
├── app/
│   ├── (ui)/page.tsx               # 工作台：EdgeBar + Sidebar + DockLayout
│   └── api/
│       ├── projects/route.ts
│       ├── understand/route.ts     # 四维派发（⌥1 SSE，其余 JSON）
│       ├── agent/route.ts          # Agent Bar（SSE）
│       ├── techstack/route.ts      # 技术栈清单
│       ├── tech/[slug]/route.ts    # 技术通用认知（全局缓存）
│       ├── events/route.ts
│       └── jobs/[id]/stream/route.ts
├── components/
│   ├── shell/                      # EdgeBar, Sidebar, DockLayout(Dockview)
│   ├── tree/  code/                # 文件树 / CodeMirror
│   ├── card/                       # ⌥1 FloatingCard + TrajectoryTab
│   ├── graph/                      # ⌥2/⌥3 ReactFlow + dagre 布局
│   ├── treemap/                    # ⌥4
│   ├── techstack/                  # 技术栈面板 + 认知卡片
│   ├── agent/                      # Agent Bar 面板（流式/引用/动作/建议）
│   └── ui/                         # shadcn 基础件（按 Design System 主题）
├── lib/
│   ├── api/        # data-access：index.ts(接口) + mock/ + real/
│   ├── focus/      # Focus Resolver
│   ├── uiactions/  # UI-action 调度器（焦点解析与 Agent 共用）
│   ├── ai/         # LLMProvider 抽象 + TaskProfile
│   ├── parse/      # tree-sitter：符号/引用/调用
│   ├── pregen/     # 预理解管线（map-reduce + 模块关系 + 结构校验）
│   ├── techstack/  # 检测 + 通用认知缓存
│   └── agent/      # 编排循环 + 工具集
├── stores/         # Zustand：focus / panels / trajectory / agent
├── types/contract.ts
├── db/schema.prisma
├── worker/         # 后台任务消费
├── fixtures/       # 前端 mock 数据（= 契约形状）
└── styles/tokens.css
```

---

## 3. 前端骨架与状态（先搭这层，后面所有交互挂上去）

### 3.1 布局骨架
`app/(ui)/page.tsx` ＝ `<EdgeBar/>`（最左竖向图标栏：项目/文件树/搜索/技术栈/Agent/轨迹/设置）＋ `<Sidebar/>`（可收起，渲染当前 Edge 入口对应面板）＋ `<DockLayout/>`（Dockview：代码 / ⌥2 / ⌥3 / ⌥4 各为可停靠面板）＋ `<FloatingLayer/>`（⌥1 浮卡 + 轨迹，绝对定位，不占面板）。

### 3.2 Zustand stores（前端真相源）
```ts
// stores/focus.ts
interface FocusState { current?: Focus; setFocus(f: Focus): void; }
// stores/panels.ts —— 面板开合/激活，供 Option 与 Agent 共同驱动
interface PanelState {
  open: Record<'call'|'flow'|'arch'|'agent'|'techstack', boolean>;
  active?: string;
  openPanel(id: string): void; closePanel(id: string): void;
  highlight?: { panel: string; nodeIds: string[] };  // 图上高亮
  setHighlight(panel: string, nodeIds: string[]): void;
}
// stores/trajectory.ts —— 见 §4.5
// stores/agent.ts —— Agent 会话/消息/流式缓冲
```
**关键：面板与焦点状态是 Option 交互与 Agent 驱动界面的同一套真相源**（§4.7 / §7）。

---

## 4. 核心交互实现（重点）

目标：**选中任意对象 → 按 ⌥1/⌥2/⌥3/⌥4 → 对应维度理解就位 → 四维瞬时切、焦点不变 → 浮卡固定停留并收纳成轨迹 → 在更细对象再 Option 即钻取。**

### 4.1 焦点解析 Focus Resolver（`lib/focus`）
把异构目标统一成 `Focus`。这是"同一手势、语境感知"的根。
```ts
// 入口：在按下 Option+N 的瞬间求"当前焦点"
function resolveFocus(): Focus | null {
  const el = document.activeElement;
  // 1) 代码面板：CodeMirror 有选区→selection；否则取光标处 token
  if (isCodeMirror(el)) {
    const view = currentCMView();
    const sel = view.state.selection.main;
    if (!sel.empty) return { type:'selection', ref: currentFileId(), selection: toSel(sel) };
    const tok = tokenAt(view, sel.head);                 // 光标处标识符
    const sym = lookupSymbol(currentFileId(), tok.line, tok.text); // 查 symbols 索引
    if (sym?.kind === 'variable') return { type:'variable', ref: sym.id };
    if (sym?.kind === 'function'|'class') return { type: sym.kind, ref: sym.id };
    return { type:'file', ref: currentFileId() };
  }
  // 2) 文件树节点
  if (isTreeNode(el)) return treeNodeToFocus(el);          // file | folder(module)
  // 3) 图节点（⌥2/⌥3/⌥4）
  if (isGraphNode(el)) return graphNodeToFocus(el);        // function|class|module
  return useFocus.getState().current ?? null;              // 回退到上次焦点
}
```
`lookupSymbol` 走 M1 建好的 `symbols` 索引（按 file+line+name），**确定性、本地、免费**。

### 4.2 Option 数字键派发（全局键盘）
```ts
// 全局监听，注意：⌥ 在 Mac 上 e.altKey；数字用 e.code('Digit1'..'Digit4') 避免 Option 改键位
window.addEventListener('keydown', (e) => {
  if (!e.altKey) return;
  const dim = ({Digit1:1,Digit2:2,Digit3:3,Digit4:4} as const)[e.code];
  if (!dim) return;
  e.preventDefault();
  const focus = resolveFocus();
  if (!focus) return;
  useFocus.getState().setFocus(focus);
  dispatchDimension(focus, dim);     // §4.3
  reportEvent({ action:`dim${dim}`, focusType:focus.type, focusRef:focus.ref, ts:now() });
});
```
**焦点不变、只换维度**：切 ⌥2→⌥4 时 `focus` 不变，只调不同 payload、开不同面板。

### 4.3 四维渲染器 `dispatchDimension(focus, dim)`
```ts
async function dispatchDimension(focus: Focus, dim: Dimension) {
  if (dim === 1) return openFloatingCard(focus);          // §4.4，浮层
  const panelId = ({2:'call',3:'flow',4:'arch'} as const)[dim];
  panels.openPanel(panelId);                              // 首次触发自动打开面板
  const res = await api.understand({ projectId, focus, dimension: dim });
  renderPanel(panelId, res);                              // ⌥2/⌥3: ReactFlow+dagre; ⌥4: Treemap
}
```
- **⌥2/⌥3（`components/graph`）**：拿 `CallGraphPayload/ExecPathPayload` → 用 **dagre/ELK** 布局（`lib` 里封 `layoutDag(nodes, edges, {rankdir:'TB', focusCentered:true})`）→ ReactFlow 渲染**实心节点卡片**（Design System §9.12）+ 连线 NL；渲染后 `fitView()`。当前焦点节点居中、调用者上/被调用者下、不重叠。
- **⌥4（`components/treemap`）**：拿 `ArchitecturePayload.root` → D3/Nivo treemap，中性明度阶、可点击下钻 + fit。

### 4.4 ⌥1 浮卡生命周期 + SSE
```ts
async function openFloatingCard(focus: Focus) {
  const card = trajectory.activate(focus);               // 新建 active 卡（§4.5）
  if (focus.type === 'selection') {
    for await (const ev of api.understandStream({projectId, focus, dimension:1}))
      ev.done ? trajectory.fill(card.id, ev.done) : trajectory.appendDelta(card.id, ev.delta);
  } else {
    const res = await api.understand({projectId, focus, dimension:1}) as CardPayload;
    trajectory.fill(card.id, res);                        // 文件/模块直读、变量 AST、函数懒生成
  }
}
```
浮卡用 Floating UI 贴着焦点元素定位；**固定停留**（非 hover 即走）。

### 4.5 理解轨迹状态机（`stores/trajectory`）
卡片三态：`active`（完整浮卡，停在原地）→ 新位置触发时旧卡 `collapsed`（收缩成标签）→ 点标签 `recall`（重新展开为 active）。
```ts
type CardStatus = 'active' | 'collapsed';
interface TrajItem { id:string; focus:Focus; status:CardStatus; payload?:CardPayload; deltas:string; order:number; }
interface TrajState {
  items: TrajItem[];
  activate(focus: Focus): TrajItem;     // 1) 把现有 active 全部 collapse 2) push 新 active
  appendDelta(id,d): void; fill(id,p): void;
  recall(id): void;                     // collapsed → active（其余 active 先 collapse）
  clear(): void;                        // Esc 清空（保留钉选）
}
```
- `activate`：先把当前 `active` 卡置 `collapsed`（触发收缩动画 ~200ms），再 push 新 active。
- 标签排布与保留数量见 PRD 开放问题（默认保留最近 N，可钉选）。每次 activate/collapse/recall 都 `reportEvent`（成长信号）。

### 4.6 钻取
不设新键：用户把焦点移到更细对象（图节点/文件树/光标）再 Option → 走 §4.2 同一路径，新卡 active、旧卡 collapse、相关面板随焦点联动刷新。浮卡内关系词做成可点链接：点击＝`setFocus(thatObject)` 再 `dispatchDimension`。

### 4.7 UI-action 调度器（`lib/uiactions`）—— 关键复用点
把"打开面板 / 跳焦点 / 图上高亮 / 触发维度"抽成**一个调度器**，Option 交互和 Agent Bar（§7）都调它。这样 Agent"驱动界面"与用户手动操作走同一套状态，天然一致。
```ts
type UIAction =
  | { kind:'open_panel'; panel:'call'|'flow'|'arch'|'techstack' }
  | { kind:'focus'; focus: Focus }
  | { kind:'highlight'; panel:string; nodeIds:string[] }
  | { kind:'trigger_dimension'; focus: Focus; dimension: Dimension };
function runUIAction(a: UIAction) { /* 写 panels/focus store，必要时 dispatchDimension */ }
```

---

## 5. 预理解管线（重点：把"架构-模块关系"真正理解到）

目标：导入后，**不靠模型乱猜**地建立"项目由哪些模块组成、模块之间什么关系、各自在业务里干嘛、用了什么技术栈"，并持久化供 ⌥/技术栈/Agent 直读。`lib/pregen` + `worker`。

### 5.1 索引 + 符号/引用/调用（`lib/parse`，确定性骨架）
1. 遍历文件 → `files`（过滤 `node_modules/.git/dist/...`、二进制、>512KB）。
2. web-tree-sitter 按语言解析每个源文件 → 抽取 `symbols`（函数/类/方法/变量 + 位置/签名）。
3. 解析引用与调用 → `symbol_refs`（read/write/call/def）；按 call 聚合成 `call_edges`（caller→callee）。
4. 解析 import/require → 文件级依赖边。
> 这一层全部**确定性**，是后面模块关系与四维的地基。

### 5.2 文件级摘要（Map，廉价档 + Batch）
对每个源文件用 `file_card` TaskProfile 生成结构化摘要（职责、关键导出、依赖、在业务中的角色）→ `file_summaries`。走 Batch API（~5 折）+ 提示缓存。

### 5.3 模块聚类 + 模块关系推断（核心）
```
clusterModules(files, callEdges, imports):
  # ① 边界：先按目录/包 + 约定（index/入口）切初始模块
  modules = byDirectoryAndPackage(files)
  # ② 关系：把"符号级"调用/依赖向上汇聚成"模块级"关系（确定性）
  for edge in callEdges + imports:
    m1 = moduleOf(edge.from); m2 = moduleOf(edge.to)
    if m1 != m2: moduleRel[m1][m2] += 1          # 依赖强度
  entries = modulesWithExternalEntry(files)       # 谁是入口（被外部/路由调用）
  # ③ 语义：在"确定的关系骨架"上用模型补语义（module_arch 档）
  for m in modules:
    m.responsibility, m.business_role, m.whyOrganized = LLM(summaries(m), moduleRel[m])
    m.relationNotes = LLM 为每条 moduleRel 生成一句话（写 edge_explanations）
  persist modules(depends_on=moduleRel, is_entry, ...) + edge_explanations
```
**要点**：关系骨架（谁依赖谁、数据往哪流、谁是入口）来自 `call_edges/import` 的**确定性聚合**；模型只负责把骨架翻译成人话（职责、为什么这样组织、关系一句话）。这正是"把架构-模块关系理解到"的落地，且**可信、可数、可校验**。

### 5.4 架构合成 + 结构迭代精修 + 文件名/数量校验
```
generateStructure(project):
  prev = null
  for round in 1..MAX (default 5):
    struct = LLM(structure_gen, summaries + moduleRel + fileList, prev)   # 产出结构(+连线解释)
    acc = validate(struct, fileIndex)            # TP/FP/FN：图里文件是否都真实、有无漏
    write structure_iterations(round, acc, missing, extra)
    if acc 稳定 or round==MAX or 超成本上限: break
    prev = struct + diff(missing, extra)         # 把漏/错喂回下一轮
  persist structure_nodes (⌥4 Treemap) + project_analysis(架构概述/技术栈)
```
`validate` 用**确定的文件名/数量**当 ground truth，AI 自判不算数。

### 5.5 持久化与增量
全部入库；二次打开直读。文件变更按 `content_hash` 判脏 → 仅重算受影响文件摘要 → 向上滚动更新所属模块关系/结构（不全量重跑）。

### 5.6 成本控制（落地）
廉价档跑文件摘要 + Batch + 缓存；模块/架构/结构用中等档但只读摘要；结构设轮次上限；每项目成本软上限，超限暂停并提示。量级见 Spec §4.9。

---

## 6. 技术栈认知（Tech Stack，`lib/techstack`）

1. **检测（确定性）**：解析 `package.json/requirements.txt/go.mod/...` + 扩展名 + 配置文件 → `tech_stack_items`（语言/框架/库/工具/数据存储 + 版本 + detected_from）。不靠模型。
2. **通用认知（全局缓存）**：「是什么/用途/生态位置」按 `slug` 存全局 `tech_literacy`——所有项目共用，**首次未命中才调一次廉价模型**，之后近乎免费。`GET /api/tech/:slug`。
3. **本仓库角色/使用处**：从 `project_analysis` + `symbol_refs`（哪里 import/用）算出"在本仓库扮演什么、关键位置在哪"，写 `tech_stack_items.usage_refs/role`。
4. **联动**：技术项 ↔ ⌥4 Treemap 互跳；点"使用处"→ `setFocus` → 可接 ⌥2/⌥3。前端在 Edge bar「技术栈」面板。

---

## 7. Agent Bar 实现（P0，`lib/agent` + `components/agent`）

开放式探索：处理跨焦点、不落单一维度的问题。能力＝**读 + 驱动界面 + 主动建议**。

### 7.1 编排循环（后端，SSE）
```
POST /api/agent {projectId, sessionId?, message}  ->  SSE
agentLoop(message, ctx):
  plan = LLM(agent, system + tools + message + history)
  while not done and steps < MAX:
    call = plan.nextToolCall
    obs  = runTool(call)            # 见 7.2
    emit citations from obs
    plan = LLM(agent, ...history, obs)
    if plan.uiActions: emit each as `action`     # 见 7.3
    if plan.answerDelta: emit `token`
  emit `suggestion`[]               # 接下来看哪/可能漏了什么（每条带 action）
  emit `done`; persist agent_messages
```
事件五类：`token / citation / action / suggestion / done`。

### 7.2 工具集（复用既有服务，多为直读/缓存→省）
- `retrieve(query)`：全量 RAG（pgvector + 关键词）召回代码块/摘要（P1 前用 symbol/结构检索兜底）。
- `getSymbols / getCallGraph / getRefs`：确定性结构查询。
- `dimension(focus, n)`：复用四维服务（等于"Agent 自己按 ⌥"）。
- `getStructure / getTechStack`：读架构与技术栈。

### 7.3 驱动界面（前端复用 §4.7 调度器）
后端 `action` 事件 = `UIAction`，前端收到即 `runUIAction(a)`：打开 ⌥2 面板、跳焦点、图上高亮鉴权相关节点……**和用户手动操作走同一套 store**。导航类即时执行；写/副作用类弹二次确认（本阶段基本无）。

### 7.4 前端面板（`components/agent`）
可停靠/可收起、随拉随走（Dockview 一个面板 + Edge bar「Agent」入口 + 快捷键 ⌘K/⌘L 聚焦输入）。渲染：流式文本、引用 chip（点击 = `setFocus` 跳转）、动作按钮/自动执行、底部建议列表（点击执行其 action）。会话存 `agent_sessions/agent_messages`，动作进 `interaction_events`。

---

## 8. 前后端契约（`types/contract.ts` · 唯一接缝）

```ts
// ===== Focus / 维度 =====
export type FocusType = 'folder'|'file'|'module'|'function'|'class'|'variable'|'selection';
export interface Selection { fileId:string; startLine:number; startCol:number; endLine:number; endCol:number; }
export interface Focus { type:FocusType; ref:string; selection?:Selection; }
export type Dimension = 1|2|3|4;
export interface UnderstandRequest { projectId:string; focus:Focus; dimension:Dimension; }

// ===== ⌥1 卡片 =====
export interface CodeExplanation {
  language?:string; syntax?:string[];
  lineByLine?:{lines:string;explain:string;why:string}[];
  positionInContext?:string; role?:string;
  concepts?:{slug:string;name:string;confidence:number}[];
  generalization?:{where:string;note:string}[];
}
export interface VariableRefs { definedAt:string; reads:number; writes:number; usedBy:{symbol:string;at:string}[]; }
export interface CardPayload {
  kind:'card'; focus:Focus; title:string;
  summary?:string; explanation?:CodeExplanation; variableRefs?:VariableRefs;
  source:'realtime'|'file_summaries'|'modules'|'symbol_card'|'ast';
  canPin?:boolean; drillTo?:{scope:string};
}

// ===== ⌥2/⌥3/⌥4 =====
export interface GraphNode { id:string; label:string; kind:'function'|'class'|'module'|'file'; isFocus?:boolean; }
export interface GraphEdge { from:string; to:string; relation:'calls'|'imports'|'depends'; nl?:string; }
export interface CallGraphPayload { kind:'callgraph'; focus:Focus; nodes:GraphNode[]; edges:GraphEdge[]; source:string; }
export interface ExecStep { order:number; symbol:string; at:string; describe:string; }
export interface ExecPathPayload { kind:'execpath'; focus:Focus; steps:ExecStep[]; note?:string; source:string; }
export interface TreemapNode { id:string; name:string; kind:'dir'|'file'|'module'; loc:number; children?:TreemapNode[]; }
export interface ArchitecturePayload {
  kind:'architecture'; focus:Focus; root:TreemapNode;
  overview:{summary:string; entryPoints:string[]; readingGuide:string[]}; techStack:string[];
}
export type UnderstandResponse = CardPayload|CallGraphPayload|ExecPathPayload|ArchitecturePayload;

// ===== 浏览 / 技术栈 =====
export interface TreeNode { id:string; name:string; path:string; kind:'dir'|'file'; children?:TreeNode[]; }
export interface FileContent { content:string; lang:string; }
export interface TechItem { slug:string; name:string; kind:'language'|'framework'|'library'|'tool'|'datastore'; version?:string; role?:string; usageRefs?:{at:string}[]; }
export interface TechLiteracy { slug:string; name:string; what:string; purpose:string; ecosystemPosition:string; }

// ===== UI 动作（Option 与 Agent 共用，§4.7/§7.3）=====
export type UIAction =
  | { kind:'open_panel'; panel:'call'|'flow'|'arch'|'techstack' }
  | { kind:'focus'; focus:Focus }
  | { kind:'highlight'; panel:string; nodeIds:string[] }
  | { kind:'trigger_dimension'; focus:Focus; dimension:Dimension };

// ===== Agent Bar 流式事件 =====
export interface Citation { label:string; ref:string; kind:'file'|'symbol'|'node'; }
export interface Suggestion { text:string; action?:UIAction; }
export type AgentEvent =
  | { type:'token'; delta:string }
  | { type:'citation'; citation:Citation }
  | { type:'action'; action:UIAction }
  | { type:'suggestion'; suggestions:Suggestion[] }
  | { type:'done'; messageId:string };
export interface AgentRequest { projectId:string; sessionId?:string; message:string; }

// ===== 交互事件 =====
export interface InteractionEvent {
  action:'select'|'dim1'|'dim2'|'dim3'|'dim4'|'drill'|'recall'|'agent';
  focusType:FocusType; focusRef:string; level?:'arch'|'module'|'code'; dwellMs?:number; ts:string;
}
```

---

## 9. data-access 层与 mock（`lib/api`）

```ts
export interface GlintApi {
  tree(projectId:string): Promise<TreeNode>;
  file(projectId:string, path:string): Promise<FileContent>;
  understand(req:UnderstandRequest): Promise<UnderstandResponse>;
  understandStream(req:UnderstandRequest): AsyncIterable<{delta:string}|{done:CardPayload}>;
  architecture(projectId:string): Promise<ArchitecturePayload>;
  techstack(projectId:string): Promise<TechItem[]>;
  tech(slug:string): Promise<TechLiteracy>;
  agent(req:AgentRequest): AsyncIterable<AgentEvent>;
  logEvents(events:InteractionEvent[]): Promise<void>;
}
export const api: GlintApi = process.env.NEXT_PUBLIC_API_MODE==='real' ? realApi : mockApi;
```
**fixtures 至少覆盖**：① 一个示例项目的 tree + 几个文件内容；② 四维各 1–2 个焦点（含变量 `usedBy`、一个 8–12 节点的调用图、一个 execpath、一个 treemap）；③ 技术栈 5–8 项 + 2 个 `tech` 认知；④ **一段 Agent 流式脚本**（token→citation→action(open_panel/highlight)→suggestion→done），让 Agent Bar 不接后端也能演全套。

---

## 10. 里程碑（M0–M4，含新特性落点）

**M0 骨架**（~1 周）：Next.js+TS+Tailwind+shadcn+令牌主题；Dockview+EdgeBar+Sidebar 空壳；Prisma 建全表（含 `tech_stack_items/tech_literacy/agent_sessions/agent_messages`）；AI 抽象层 + TaskProfile；`types/contract.ts` + `lib/api` mock 空实现。**DoD**：厂商调用记账闭环；空壳可拖拽停靠、切主题、Edge bar 可切面板。

**M1 导入与浏览**（~1–2 周）：上传/索引；tree-sitter `symbols/symbol_refs/call_edges`；文件树 + CodeMirror。**DoD**：浏览/打开/选中代码；变量引用、调用边可查。

**M2 预理解 + ⌥4 + 技术栈**（~2–3 周）：Worker+进度SSE；§5 预理解管线（文件摘要→**模块聚类+关系推断**→架构合成→结构迭代校验）；⌥4 Treemap；§6 技术栈检测+认知+面板。**DoD**：数分钟内拿到模块/关系/架构/Treemap/技术栈；二次读库。

**M3 四维交互 + Agent Bar + 记录**（~3–4 周，核心）：§4 焦点解析+Option 派发+⌥1 浮卡+⌥2 调用图(dagre)+轨迹+钻取+UI-action 调度器；§7 Agent Bar（编排+工具+流式+驱动界面+建议）；记录+事件入库。⌥3 执行路径紧随。**DoD**：选中按 ⌥1/⌥2/⌥4 即得、四维可切；浮卡收纳成轨迹；Agent Bar 能答+跳引用+开面板高亮+给建议。**主链路打通。**

**M4 扩展**：⌥3 深化、泛化检索、全量 RAG（强化 Agent 检索）、成长分析、上线相关。

---

## 11. 约定

- 样式只用 Design System 语义令牌（禁裸 hex）；五态齐全；focus-visible 必现蓝环。颜色克制（唯一电蓝；四维靠键帽+图标区分）。
- 图必 dagre/ELK + fit-to-bounds + 不重叠；节点实心卡片，禁霓虹空心框。
- 跨前后端形状一律从 `types/contract.ts` import；改契约前后端同步改。
- **Option 交互与 Agent 驱动界面共用 `lib/uiactions` + 同一套 store**（一致性关键）。
- 确定性优先：符号/调用/模块关系/技术栈来自 AST 与清单，模型只补语义。
- Conventional Commits，小步提交；可访问性达 Design System §11；成本走直读/缓存 + 软上限。

---

## 12. 里程碑验收清单

- [ ] M0 调用记账闭环；Edge bar+Sidebar+Dock 空壳+主题。
- [ ] M1 上传/索引/符号·引用·调用；树+代码可浏览选中。
- [ ] M2 预理解（摘要/**模块关系**/架构/结构校验）+ ⌥4 + 技术栈面板；读库。
- [ ] M3 焦点解析+Option 四维（⌥1 浮卡/⌥2 dagre 图/轨迹/钻取）；**Agent Bar（读+驱动+建议）**；记录+事件。
- [ ] 集成：`lib/api` 各方法 mock→real，逐个切换不改组件。
- [ ] 主链路打通 = M3 完成。

---

## 13. 施工时最容易踩的坑

1. **⌥3 执行路径**最复杂（动态语言 trace 不精确）——先出近似版+标注，别卡主链路。
2. **模块关系别让模型瞎编**：关系骨架必须来自 `call_edges/import` 的确定性聚合，模型只翻译成人话（§5.3）。
3. **Agent 驱动界面要和手动交互同源**：务必复用 `lib/uiactions` + 同一 store，否则状态会打架。
4. **图布局**：不用 dagre/ELK 就节点重叠/被切——⌥2/⌥3 能不能用的关键。
5. **前端 mock 形状偏离契约**：尤其 Agent 流式事件与 UIAction，集成才暴雷——以 `types/contract.ts` 为唯一真相。
6. **预生成成本**：先小项目校准轮次与成本，软上限兜底，悬停/技术栈通用知识走直读/全局缓存。
7. **UI 抢色**：chrome 上多色就和代码语法高亮打架——保持中性 + 单一电蓝。

---

## 修订历史

| 版本 | 日期 | 摘要 |
| --- | --- | --- |
| v0.2 | 2026-06-20 | 实现级：核心交互 / 预理解管线 / 技术栈 / Agent Bar 全展开 + 完整契约 + 伪代码 |
| v0.1 | 2026-06-20 | 首版：契约优先 + 前端 mock 先行 + M0–M4 步骤与 DoD |

> 版本管理规范见 `VERSIONING.md`。
