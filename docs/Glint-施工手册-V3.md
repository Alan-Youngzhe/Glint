# Glint 施工手册 V3（三期工程）

| 项目 | 内容 |
| --- | --- |
| 版本 | v1.0 |
| 期次 | **三期**（M3 选中+Option 四维交互 + Agent Bar + 理解轨迹）—— 产品灵魂层 |
| 状态 | 可执行 · 承接一、二期代码 + 设计稿 |
| 最后更新 | 2026-06-20 |
| 关联 | 《Glint-PRD.md》v0.8 ·《Glint-技术Spec.md》v0.6 ·《Glint-施工手册.md》(M0–M4 总参考) ·《Glint-施工手册-V2.md》(二期) ·《design-system/Glint-Design-System.md》**§15**（界面唯一依据） |
| 执行者 | 下一个 AI 编码 agent |

> 本手册落地**核心交互与 Agent Bar**，全部按设计稿（DS §15）实现。承接一期 M0 骨架 + 二期 M1/M2，在现有代码上往上建。文中路径均为仓库真实位置或要新建处。

---

## 0. 期次定位

| 期 | 范围 | 状态 |
| --- | --- | --- |
| 一期 | M0 工程骨架 | ✅ 已落代码 |
| 二期 | M1 导入浏览 + M2 预理解/架构/技术栈 | ✅ 手册 V2（应已落或在落） |
| **三期** | **M3 四维交互 + Agent Bar + 轨迹** | ▶ **本手册** |
| 四期 | M4 ⌥3 深化 / 泛化检索 / 全量 RAG / 成长分析 / 上线 | ⏳ 手册 V4 |

三期范围：选中 + `Option` 四维手势、`⌥1` 就近浮卡、`⌥2/⌥3` INSIGHT 图、FocusBar（来源标签）、维度切换条、底部轨迹条、钻取、Agent Bar、记录/事件入库、`understand`/`agent` 真实接通。

---

## 1. 前两期现状盘点（V3 在其上建，不重写）

| 已有（一/二期） | 位置 | 三期怎么用 |
| --- | --- | --- |
| 四维核心契约 | `types/contract.ts`（Focus/Dimension/各 Payload/`CardPayload.source`/UnderstandStreamChunk/InteractionEvent） | 三期**追加** UIAction/Agent 类型 + provenance 映射（§3） |
| data-access | `lib/api/index.ts`（GlintApi：tree/file/understand/understandStream/architecture/logEvents；二期加 techstack/tech） | 三期**追加** `agent()`，并把 understand/understandStream/agent/logEvents 的 real 接通 |
| AI 抽象层 | `lib/ai/` | Agent 编排、⌥1 实时解释、⌥3 叙述直接调它，按 TaskProfile |
| 符号/调用/结构 | `db`：Symbol/SymbolRef/CallEdge/Module/StructureNode/EdgeExplanation/DimensionCache 等（二期已填） | ⌥1 变量/函数、⌥2 调用图、⌥3 trace、⌥4 直读全靠它 |
| 记录地基 | `db`：QueryLog/ConceptTag/QueryConceptTag/InteractionEvent/TrajectoryItem | 三期开始写入 |
| 布局壳 | `components/layout/{DockShell,Workbench,ThemeToggle}` + 二期 EdgeBar/Sidebar | 三期补 FocusBar/DimensionSwitcher/FloatingCard/InsightPanel/TrajectoryBar/StatusBar |
| 设计稿 | `design-system/design/` + **DS §15** | 所有界面按 §15；不再自由发挥 |

**三期缺口（补）**：契约 UIAction/Agent 类型；schema `agent_sessions`/`agent_messages`；`lib/{focus,uiactions,agent}`；`stores/{focus,insight,trajectory,agent}`；`components/{shell 的 FocusBar+DimensionSwitcher+TrajectoryBar+StatusBar, card, graph, agent}`；`app/api/{understand,agent,events}` 真实路由。

---

## 2. 三期目标与完成标准（DoD）

**一句话**：选中任意对象，按 `⌥1/⌥2/⌥3/⌥4` 即在对应维度获得理解，四维瞬时切、焦点不变；理解留痕成底部轨迹；Agent Bar 能开放探索并驱动界面。

DoD 全满足：
1. 焦点解析：代码光标/选区、文件树节点、图节点统一成 `Focus`。
2. `⌥1` 就近浮卡：带**来源标签**；选中代码＝三段（这是什么/逻辑怎么走/在上下文中的位置）实时流式；文件/模块＝单段（负责什么）直读；变量＝引用（AST）；函数/类＝懒生成缓存。
3. `⌥2`/`⌥3` 进**右侧 INSIGHT 面板的 Tab**：⌥2 调用图（dagre 布局、实心节点、连线 NL、fit、当前居中/调用者上/被调用者下）；⌥3 执行路径（泳道、循环×items）。`⌥4` 复用二期 Treemap，接到 Option 手势。
4. 维度切换条（⌥1 为什么/⌥2 谁调用/⌥3 怎么执行/⌥4 在哪）+ FocusBar（焦点+来源标签）。
5. 浮卡底部动作（跳到 X→、⌥2 调用关系→）驱动焦点/面板。
6. 底部 **TrajectoryBar**：新触发收纳旧卡为 chip，面包屑、点击跳回、Clear/Esc。
7. 钻取：更细对象再 Option。
8. **Agent Bar**：可停靠/收起面板；问→检索/跟踪/综合答（带跳转引用）+ 驱动界面（开面板/跳焦点/图上高亮）+ 末尾建议。
9. `query_logs` + 概念标签 + `interaction_events` 入库。
10. `lib/api` 的 `understand`/`understandStream`/`agent`/`logEvents` 已 mock→real。

---

## 3. 契约增量（`types/contract.ts` 追加）

```ts
// ===== UI 动作（Option 与 Agent 共用，§6.8 / §7.3）=====
export type UIAction =
  | { kind: "open_panel"; panel: "call" | "flow" | "arch" | "techstack" | "agent" }
  | { kind: "focus"; focus: Focus }
  | { kind: "highlight"; panel: string; nodeIds: string[] }
  | { kind: "trigger_dimension"; focus: Focus; dimension: Dimension };

// ===== Agent Bar 流式事件 =====
export interface Citation { label: string; ref: string; kind: "file" | "symbol" | "node"; }
export interface Suggestion { text: string; action?: UIAction; }
export type AgentEvent =
  | { type: "token"; delta: string }
  | { type: "citation"; citation: Citation }
  | { type: "action"; action: UIAction }
  | { type: "suggestion"; suggestions: Suggestion[] }
  | { type: "done"; messageId: string };
export interface AgentRequest { projectId: string; sessionId?: string; message: string; }
```
`GlintApi`（`lib/api/index.ts`）追加：`agent(req: AgentRequest): AsyncIterable<AgentEvent>;`
`InteractionEvent.action` 增加 `"agent"`（已含 select/dim1-4/drill/recall）。

**来源标签映射（provenance，DS §15.3）**——`CardPayload.source` 已存在，加一个纯函数：
```ts
export function provenanceLabel(s: CardPayload["source"]): string {
  return { realtime:"实时 · 调 AI 解释", file_summaries:"预生成 · 库内直读",
           modules:"预生成 · 库内直读", ast:"AST · 确定", symbol_card:"懒生成 · 已缓存" }[s];
}
```

---

## 4. 数据模型增量（`db/schema.prisma` 追加）

```prisma
enum AgentRole { user assistant tool }

model AgentSession {
  id        String         @id @default(cuid())
  userId    String         @map("user_id")
  projectId String         @map("project_id")
  title     String?
  createdAt DateTime       @default(now()) @map("created_at")
  messages  AgentMessage[]
  @@index([userId, projectId])
  @@map("agent_sessions")
}

model AgentMessage {
  id          String    @id @default(cuid())
  sessionId   String    @map("session_id")
  role        AgentRole
  content     String
  citations   Json?
  actions     Json?
  suggestions Json?
  toolCalls   Json?     @map("tool_calls")
  tokens      Int       @default(0)
  costUsd     Float     @default(0) @map("cost_usd")
  createdAt   DateTime  @default(now()) @map("created_at")
  session     AgentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@index([sessionId])
  @@map("agent_messages")
}
```
`pnpm db:migrate` 生效。

---

## 5. 前端骨架补齐（严格按 DS §15）

`app/(ui)/page.tsx` 自上而下（见 DS §15.1 布局图）：`<TopBar/>` → 主体三栏（`<EdgeBar/>` + `<Sidebar/>` + `<EditorArea/>` + `<InsightPanel/>`）→ 底部 `<TrajectoryBar/>` + `<StatusBar/>`。

**stores（Zustand）**
```ts
// stores/focus.ts
interface FocusState { current?: Focus; provenance?: string; setFocus(f: Focus): void; }
// stores/insight.ts —— 右侧 INSIGHT 单面板的当前 Tab（设计：三 Tab 合一）
interface InsightState { tab: "call"|"flow"|"arch"; open: boolean;
  setTab(t): void; openWith(t): void; highlight?: {tab:string; nodeIds:string[]}; setHighlight(t,ids): void; }
// stores/trajectory.ts —— 见 §6.6
// stores/agent.ts —— 会话/消息/流式缓冲
```
> 注意（设计定案）：右侧是**一个 INSIGHT 面板 + 三 Tab**，故用 `insight.tab` 而非三个独立面板 store。轨迹是**底部 TrajectoryBar**，不在浮层。

---

## 6. 核心交互实现

目标见 §2。所有视觉/文案以 DS §15 为准。

### 6.1 焦点解析 Focus Resolver（`lib/focus`）
把异构目标统一成 `Focus`（确定性、本地、免费）：
```ts
function resolveFocus(): Focus | null {
  const el = document.activeElement;
  if (isCodeMirror(el)) {
    const v = currentCMView(); const sel = v.state.selection.main;
    if (!sel.empty) return { type:"selection", ref: currentFileId(), selection: toSel(sel) };
    const tok = tokenAt(v, sel.head);
    const sym = lookupSymbol(currentFileId(), tok.line, tok.text); // 查二期建好的 symbols 索引
    if (sym?.kind === "variable") return { type:"variable", ref: sym.id };
    if (sym?.kind === "function" || sym?.kind === "class") return { type: sym.kind, ref: sym.id };
    return { type:"file", ref: currentFileId() };
  }
  if (isTreeNode(el)) return treeNodeToFocus(el);   // file | folder(module)
  if (isGraphNode(el)) return graphNodeToFocus(el); // function|class|module
  return useFocus.getState().current ?? null;
}
```

### 6.2 Option 数字键派发（全局键盘）
```ts
window.addEventListener("keydown", (e) => {
  if (!e.altKey) return;
  const dim = ({Digit1:1,Digit2:2,Digit3:3,Digit4:4} as const)[e.code] as Dimension | undefined;
  if (!dim) return;
  e.preventDefault();
  const focus = resolveFocus(); if (!focus) return;
  useFocus.getState().setFocus(focus);   // 同步 FocusBar
  dispatchDimension(focus, dim);
  reportEvent({ action:`dim${dim}`, focusType:focus.type, focusRef:focus.ref, ts:now() });
});

async function dispatchDimension(focus: Focus, dim: Dimension) {
  if (dim === 1) return openFloatingCard(focus);            // §6.4
  const tab = ({2:"call",3:"flow",4:"arch"} as const)[dim];
  useInsight.getState().openWith(tab);                      // 切 INSIGHT Tab，不切焦点
  const res = await api.understand({ projectId, focus, dimension: dim });
  renderInsight(tab, res);                                  // §6.5
}
```
**焦点不变、只换维度**：⌥2→⌥4 只切 `insight.tab` + 取不同 payload。维度切换条按钮点击等价调用 `dispatchDimension(currentFocus, n)`。

### 6.3 FocusBar + DimensionSwitcher（`components/shell`）
- **FocusBar**：显示当前焦点（如 `Lines 7–8` / `logger.js`）+ **来源标签** `provenanceLabel(card.source)`（DS §15.3）。焦点变即更新。
- **DimensionSwitcher**：四个按钮 `⌥1 为什么 / ⌥2 谁调用 / ⌥3 怎么执行 / ⌥4 在哪`（DS §15.2 文案）；当前维度键帽电蓝；点击＝派发。

### 6.4 ⌥1 FloatingCard（`components/card`）
锚定：Floating UI 贴焦点元素；固定停留。结构按 DS §15.4：来源徽标(`SELECTION/FILE/VARIABLE/FUNCTION`)+provenance+×、标题、概念标签 chips、正文随粒度、底部动作。
```ts
async function openFloatingCard(focus: Focus) {
  const card = useTrajectory.getState().activate(focus);  // 新 active 卡（§6.6）
  if (focus.type === "selection") {
    for await (const ev of api.understandStream({projectId, focus, dimension:1}))
      "done" in ev ? useTrajectory.getState().fill(card.id, ev.done)
                   : useTrajectory.getState().appendDelta(card.id, ev.delta);
  } else {
    const res = await api.understand({projectId, focus, dimension:1}) as CardPayload;
    useTrajectory.getState().fill(card.id, res);          // file/module 直读、variable AST、function 懒生成
  }
}
```
- 正文：selection ⇒ `explanation`（三段 这是什么/逻辑怎么走/在上下文中的位置 + 概念标签 + gotchas）；file/module ⇒ `summary`（单段 负责什么）+ 类型 tag；variable ⇒ `variableRefs`（从哪来/谁读谁改）。
- 底部动作来自 `card`（如 `跳到 getSession→`=`{kind:'focus'}`，`⌥2 调用关系→`=`{kind:'trigger_dimension',dimension:2}`），点击走 §6.8。

### 6.5 INSIGHT 面板（`components/graph` + 复用 treemap）
单面板三 Tab（DS §15.5）。
- **⌥2 调用图**：`CallGraphPayload` → `layoutDag(nodes, edges, {rankdir:"TB", focusCentered:true})`（dagre/ELK）→ ReactFlow 渲染**实心节点卡片**（DS §9.12）+ 连线 NL；`fitView()`；当前节点居中、调用者上/被调用者下、不重叠。
- **⌥3 执行路径**：`ExecPathPayload` → 泳道/时序，按 `steps` 顺序，渲染「循环 × items」标记。
- **⌥4 架构鸟瞰**：复用二期 `ArchPanel`（treemap），现接到 Option 手势（⌥4 = `dispatchDimension(focus,4)`）。

### 6.6 理解轨迹 TrajectoryBar（`stores/trajectory` + `components/card/TrajectoryBar`）
底部横条（DS §15.6）。卡片三态机：
```ts
type CardStatus = "active" | "collapsed";
interface TrajItem { id:string; focus:Focus; status:CardStatus; payload?:CardPayload; deltas:string; order:number; }
interface TrajState {
  items: TrajItem[];
  activate(focus): TrajItem;  // 1) 现有 active 全 collapse 2) push 新 active
  appendDelta(id,d): void; fill(id,p): void;
  recall(id): void;           // collapsed→active（其余先 collapse）
  clear(): void;              // Esc 清空（保留钉选）
}
```
- 渲染：面包屑 chips ＝ 维度键帽（像素字）+ 标签（`第 7–8 行`/`createOrder()`）+ ×；当前 chip 电蓝；`Clear/Esc`。
- 每次 activate/collapse/recall 都 `reportEvent`（成长信号）。保留数量默认最近 N、可钉选（PRD §10）。

### 6.7 钻取
不设新键：焦点移到更细对象（图节点/树/光标）再 Option → 走 §6.2，新卡 active、旧卡 collapse、INSIGHT 随焦点刷新。浮卡内关系词＝可点链接（`setFocus`+派发）。

### 6.8 UI-action 调度器（`lib/uiactions`）——关键复用
Option 交互与 Agent 共用，保证一致：
```ts
function runUIAction(a: UIAction) {
  switch (a.kind) {
    case "open_panel": useInsight.getState().openWith(a.panel as any); break;
    case "focus": useFocus.getState().setFocus(a.focus); break;
    case "highlight": useInsight.getState().setHighlight(a.panel, a.nodeIds); break;
    case "trigger_dimension": useFocus.getState().setFocus(a.focus); dispatchDimension(a.focus, a.dimension); break;
  }
}
```

---

## 7. Agent Bar 实现

### 7.1 编排循环（`lib/agent` + `app/api/agent` SSE）
```
POST /api/agent {projectId, sessionId?, message} -> SSE(AgentEvent)
agentLoop(message, ctx):
  plan = LLM(profile=agent, system+tools+history+message)
  while !done && steps<MAX:
    obs = runTool(plan.nextToolCall)          // §7.2
    emit obs.citations as {type:'citation'}
    plan = LLM(agent, ...history, obs)
    for a in plan.uiActions: emit {type:'action', action:a}
    if plan.answerDelta: emit {type:'token', delta}
  emit {type:'suggestion', suggestions}        // 接下来看哪/可能漏了什么（每条带 action）
  emit {type:'done', messageId}; persist AgentSession/AgentMessage
```

### 7.2 工具集（复用既有服务，多为直读/缓存）
`retrieve(query)`（全量 RAG——四期落地前先用 symbol/结构检索兜底）、`getSymbols/getCallGraph/getRefs`（确定性）、`dimension(focus,n)`（复用四维服务，等于 Agent 自己按 ⌥）、`getStructure/getTechStack`。

### 7.3 驱动界面
后端 `action` 事件 = `UIAction`，前端收到即 `runUIAction(a)`（§6.8，与手动交互同源 store）。导航类即时；写/副作用类二次确认（本阶段基本无）。

### 7.4 前端面板（`components/agent`）
可停靠/收起（Dockview 一面板 + Edge bar「Agent」入口 + 快捷键 ⌘K/⌘L 聚焦输入）。渲染：流式文本、引用 chip（点击=`setFocus` 跳转）、动作（自动执行或按钮）、底部建议（点击执行其 action）。会话写 `agent_sessions/agent_messages`，动作进 `interaction_events`。

---

## 8. 真实 API + 记录落库

| 路由（新建/接通） | GlintApi | 说明 |
| --- | --- | --- |
| `POST /api/understand` | `understand`/`understandStream` | ⌥1 selection＝SSE 流式（`explain` 实时）；file/module 直读 `file_summaries`/`modules`；variable 聚合 `symbol_refs`；function/class 懒生成写 `dimension_cache`；⌥2 由 `call_edges`+`edge_explanations`；⌥3 trace+LLM 写 `dimension_cache`；⌥4 由 `structure_nodes`+`project_analysis` |
| `POST /api/agent` | `agent` | §7 SSE |
| `POST /api/events` | `logEvents` | 批量交互事件 |
| 落库 | — | 每次解释写 `query_logs` + 概念标签（随结构化输出）→ `query_concept_tags`；事件写 `interaction_events` |

接通后把 `lib/api/real` 的 understand/understandStream/agent/logEvents 从 mock 改真实；前端组件不动。

---

## 9. 三期验收清单
- [ ] 焦点解析（代码/树/图 → Focus）。
- [ ] Option 四维派发；焦点不变、四维瞬时切；维度切换条 + FocusBar(来源标签)。
- [ ] ⌥1 浮卡：三段/单段/变量/懒生成 + 来源标签 + 底部动作驱动。
- [ ] ⌥2 调用图（dagre 实心节点）/⌥3 执行路径（泳道）进 INSIGHT Tab；⌥4 接手势。
- [ ] 底部 TrajectoryBar：收纳/面包屑/跳回/Clear-Esc。
- [ ] 钻取。
- [ ] Agent Bar：读 + 驱动界面 + 建议；会话/动作入库。
- [ ] query_logs + 概念标签 + interaction_events 入库。
- [ ] understand/understandStream/agent/logEvents mock→real。
- [ ] 契约加 UIAction/Agent；schema 加 agent 两表并迁移。
- [ ] **主链路打通**（= 三期完成）。

## 10. 三期风险
| 风险 | 应对 |
| --- | --- |
| ⌥3 执行路径 trace 精度 | 基于 call_edges 静态 trace + LLM 叙述；标「近似」；先支持清晰路径（深化在四期） |
| Agent 驱动界面与手动不一致 | 强制共用 `lib/uiactions` + 同一 store（§6.8/§7.3） |
| 浮卡定位/遮挡 | Floating UI flip/shift；固定停留；超出视口回退 |
| 轨迹状态复杂 | 单一 store + 明确三态机；事件必报 |
| ⌥1 实时成本 | 仅选中代码/追问实时；其余直读/AST/懒缓存（Spec §4.3） |

## 11. 四期预告 → 《Glint-施工手册-V4.md》
M4：⌥3 深化、泛化检索、全量向量 RAG（强化 Agent retrieve）、成长分析、上线（GitHub/多用户/前端 Key）。

---

## 修订历史

| 版本 | 日期 | 摘要 |
| --- | --- | --- |
| v1.0 | 2026-06-20 | 三期施工手册首版：M3 四维交互 + Agent Bar + 轨迹，按设计稿(DS §15) + 一二期代码落地；契约/schema 增量、焦点解析/派发/浮卡/轨迹/调度器/Agent 伪代码、真实 API、DoD/风险 |

> 版本管理规范见 `VERSIONING.md`。
