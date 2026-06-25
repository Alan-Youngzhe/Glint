# Glint 借鉴实施计划

> 依据 `inference/GLINT-借鉴落地清单.md`(2026-06-25 精读 pyan / graphify / gitdiagram / codeboarding 四仓库源码)落地。
> 本文把清单 P0/P1 拆成**可独立执行、可验证、带依赖顺序**的工作包(WP)。每个 WP 给:借鉴源锚点 → Glint 落点(file:line)→ 步骤 → 迁移 → 验证 → 风险。
> 执行原则:一次只深做一个 WP,跑完该 WP 的验证(typecheck + build + e2e + 浏览器)再进下一个;每个小任务一次 git commit。

许可证总账:**pyan = GPL-2.0,只读不抄(算法重写)**;graphify / gitdiagram / codeboarding = MIT,代码可借(仍用 TS 重写适配)。

---

## 现状基线(决定什么才算新价值)

| 能力 | 现状 | 出处 |
| --- | --- | --- |
| 符号/调用抽取 | 收集全量符号后再解析调用(前向引用其实已覆盖),但**调用解析按全局名**、**无 import 感知**、**丢接收者**(`this.x()`/`obj.x()` 只留属性名) | `lib/parse/extract.ts:113-136`、`lib/parse/index.ts:124-188` |
| 调用边置信度 | 无;`CallEdge` 无 confidence 列 | `db/schema.prisma:195-204` |
| LLM→结构化图 compiler | 不存在 | — |
| SSE 阶段事件 | `/api/understand`、`/api/agent` 是 SSE,但无"阶段/重试/校验"事件模型 | `lib/understand/stream.ts`、`lib/agent` |
| 增量 | 无,`parseProject`/`pregenProject` 每次 `deleteMany` 全量重建 | `lib/parse/index.ts:95-96`、`lib/pregen/index.ts:28-31` |
| ⌥4 分层下钻 | 无,Treemap 镜像文件树;模块按顶层目录聚合(刚加角色分层) | `lib/pregen/architecture.ts`、`components/treemap/ArchPanel.tsx` |
| 预生成"确定性骨架 + LLM 可选降级" | **已做** | `lib/pregen/index.ts` |

**真缺口排序**:① ⌥2 调用图准确性(import-aware + this 绑定 + 置信度);② LLM 出结构化图 + 路径校验重试;③ 增量;④ ⌥4 分层下钻。

> 环境注意:本地**无 LLM key**,`runTaskSafe` 返回 null 自动降级。凡核心价值依赖 LLM 的 WP,本地只能验确定性部分(schema/校验/编译),端到端要等填 key。**Phase A 全程无需 key 可完整验证,故列为首选执行项。**

---

## Phase A — ⌥2 调用图准确性(P0,确定性,无 key 可验证)〔推荐先做〕

对应清单 #5 / #6 / #7。这是最高置信、本地可完整验证、直接提升 ⌥2 质量的一块。

### WP-A1 抽取层:import 映射 + 调用接收者
- **借鉴源**:pyan `analyzer.py:296-319`(prescan 建符号表)、`postprocessor.py:133-187`(`_has_import_to` 只展开到调用方 import 的同名符号);graphify `symbol_resolution.py:29-70`(`build_label_index`)、`parse_python_import_aliases`(122-150,import 别名→来源文件)。
- **Glint 落点**:`lib/parse/extract.ts`。
- **步骤**:
  1. 新增 `extractImports(root, grammar): ExtractedImport[]`,产 `{ localName, importedName, fromModule, line }`。JS:`import_statement` 的 `import_clause`(named / default / namespace);Python:`import_from_statement` / `import_statement`。
  2. `ExtractedCall` 增字段 `receiver: "none" | "this" | string`(`this`=本类方法调用;字符串=`obj.foo()` 的 `obj` 文本)。改 `extractCalls`:`member_expression` 时读 `object` 子节点文本(`this`→`"this"`,标识符→其文本),Python `attribute` 同理(`self`→`"this"`)。
  3. `ExtractedSymbol` 给 method 增 `enclosingClass?: string`(进 `class_declaration`/`class_definition` 作用域时记录类名),供 this 绑定用。
- **迁移**:无(纯内存结构)。
- **验证**:单元级——对 `tests/fixtures` 里 `archdemo2`(api→services→db)断言 import 映射数、`this.` 接收者识别。
- **风险**:tree-sitter 节点字段名因 grammar 版本而异(web-tree-sitter 0.20.8),需对 ts/tsx/js/python 各验一遍。

### WP-A2 解析层:import 优先 + this/class 绑定 + 置信度
- **借鉴源**:pyan `postprocessor.py:190-224`(wildcard 仅展开到 import 命中);graphify `symbol_resolution.py:288-350`(EXTRACTED=1.0 / INFERRED=0.8)。
- **Glint 落点**:`lib/parse/index.ts:124-188`(替换全局 `nameToId` 单一解析),建议抽到新文件 `lib/parse/resolve.ts`。
- **解析优先级(每个 call 取第一个命中,并定 confidence)**:
  1. `receiver==="this"` → 在 caller 所在 class 及其 `extends` 链查同名 method → **confidence 1.0**。
  2. `receiver==="none"`(裸 `foo()`)→ 先查**同文件**符号;再查该文件 **import 映射**命中的来源文件符号 → **1.0**。
  3. `receiver` 是某 import 的 namespace/别名 → 该来源文件符号 → **1.0**。
  4. 都不中 → 退回全局唯一同名(原行为)→ **0.5**;全局多个同名 → 取 kind 排名首个,**0.4**(AMBIGUOUS)。
- **迁移**:`CallEdge` 加 `confidence Float @default(1)`;`pnpm db:migrate`(name=`add_calledge_confidence`)。边聚合时取该边所有 call 的**最大** confidence。
- **契约**:`types/contract.ts` 的 `CallGraphPayload` 边增 `confidence?: number`;`lib/understand` 调用图查询带出。
- **前端(可选,小)**:`components/graph/CallGraph.tsx` 对 confidence<0.5 的边用 `dashed` + 降低不透明度,呼应 gitdiagram 的 solid/dashed 语义。
- **验证(无 key,e2e)**:
  - 新增 fixture:两个文件各有同名 `save()`,A import B 的 `save` → 断言只连到 B、不连到本地无关 `save`。
  - `this.foo()` 在类内连到本类 `foo` 而非全局 `foo`。
  - `archdemo2` 跨模块边 confidence==1.0;构造一条歧义边 confidence<0.5。
  - 现有 40 条 e2e 不回归(尤其 `getProfile→requireUser` 跨文件边)。

### Phase A 产出
ⓘ 一次 commit 拆为:A1 抽取(`feat(parse): 抽 import 映射 + 调用接收者`)→ 迁移+A2 解析(`feat(parse): import-aware 调用解析 + this 绑定 + 边置信度`)→ 前端样式(`feat(graph): 低置信调用边虚线弱化`)。

---

## Phase B — LLM→结构化图→路径校验→重试(P0,核心价值需 key)

对应清单 #1 / #2 / #3。纯 TS、MIT、`graph.ts`/`validate` 几乎照搬。本地无 key 只能验确定性的 schema+校验+编译;LLM 出图待填 key 端到端验。

### WP-B1 `lib/structure/` 骨架(确定性,可本地验)
- **借鉴源**:gitdiagram `src/server/generate/graph.ts:22-130`(`buildFileTreeLookup` / `parseDiagramGraph` / `validateDiagramGraph` / `formatGraphValidationFeedback`)、`src/features/diagram/graph.ts:1-66`(zod schema + `MAX_GRAPH_*` 上限)。
- **Glint 落点(新建)**:
  - `lib/structure/schema.ts`:照搬 zod `{ groups, nodes, edges }`,**节点改造**——去掉 `shape`(Mermaid 专用),`path` 保留并**新增 `startLine/endLine`**(Glint 有精确行号);上限 `MAX_GRAPH_NODES=34/EDGES=48/ATTEMPTS=3`。类型用 `z.infer` 导出。
  - `lib/structure/validate.ts`:照搬 `validateDiagramGraph`,**校验扩展**——`node.path` 命中 `Set<相对路径>`,且 `startLine` 落在该文件实际行数内(Glint 有 `File.loc`);重复 id / 未知 groupId / 悬空 edge 同 gitdiagram。`formatGraphValidationFeedback` 原样。
  - `lib/structure/compile-reactflow.ts`:把校验过的 graph 编译成 React Flow `nodes/edges`(`node.data` 挂 `{ filePath, startLine, endLine }`,`onNodeClick` 走 `setActiveFile` + 行号高亮,**不是** gitdiagram 的 GitHub blob URL);group→子流程/容器。
- **验证(无 key)**:照搬 gitdiagram `graph.test.ts` 思路写 `tests/structure.test.ts`:喂合法 graph→valid;喂幻觉 path / 越界行号 / 悬空 edge→对应 issue 文本。这部分**本地完整可验**。

### WP-B2 两遍 prompt + 重试环(需 key 端到端)
- **借鉴源**:gitdiagram `src/server/generate/prompts.ts`(第一遍 `SYSTEM_FIRST_PROMPT` 出大白话、禁 JSON;第二遍 `SYSTEM_GRAPH_PROMPT` 出结构化图)、`stream/route.ts:609-626`(`for attempt 1..3`:校验失败→`formatGraphValidationFeedback`→拼进 prompt 重试)。
- **Glint 落点**:`lib/structure/prompts.ts`(译中文,接 `runTaskSafe`);新 service `lib/structure/generate.ts` 实现重试环;接入 ⌥4(替代/增强 `architecture.ts` 的 LLM 概述)与未来 Agent Bar。
- **LLM 接入**:复用 `lib/ai`,在 `lib/ai/profiles.ts` 加 TaskProfile(如 `structure_graph`);`runTaskSafe` 无 key→null→**降级到 Phase E 的确定性目录分层**(见 WP-E1),不报错。
- **验证**:填 key 后 e2e 跑"出图→注入一个不存在 path 的对抗样本→断言重试后 path 全部命中真实文件集";无 key 时断言降级到确定性图、不抛错。

### WP-B3 SSE 阶段事件模型(P0,便宜)
- **借鉴源**:gitdiagram `src/features/diagram/types.ts:7-20`(`started→explanation_chunk→graph_sent→graph_retry→graph_validating→(reactflow)_compiling→complete/error`)。
- **Glint 落点**:`lib/understand/stream.ts`、`lib/agent` 的 SSE 输出加 `status` 字段;前端进度面板按 status 切 UI(尤其"重试第 N 次 / 校验失败原因")。`diagram_compiling`→`reactflow_compiling`。
- **验证**:e2e 解析 SSE 序列,断言出现 `graph_validating`/`graph_retry`(对抗样本时)。

---

## Phase C — 确定性增量与开关(P1)

### WP-C1 纯代码跳过 LLM 的扩展名分类表
- **借鉴源**:graphify `detect.py:20-35`(`CODE_EXTENSIONS` 69+ / `DOC/PAPER/IMAGE`)、`__main__.py:4332-4358`(`needs_llm = bool(semantic_files)`)。MIT,**分类表纯数据可抄**。
- **Glint 落点**:新 `lib/pregen/detect.ts`,把"是否需要任何 LLM pass"从"靠 key 为空隐式降级"改成**显式开关**(纯代码项目即使有 key 也可不触发语义 pass,省成本)。`lib/import/index.ts:32-56` 的 `LANG_BY_EXT` 可合并。
- **验证**:对纯 `.ts` fixture 断言 `needsLLM===false`;含 `.md` 时 `true`。

### WP-C2 增量重建(`preserved_nodes` + 脏文件 + 反向 BFS)
- **借鉴源**:graphify `watch.py:637-647`(`preserved_nodes`:重抽的用新、保留 LLM 节点、删文件丢弃、悬空边过滤)、`affected.py:96-132`(反向 BFS 算"改一个符号→受影响最小集")。
- **Glint 落点**:新 `lib/parse/incremental.ts`;`File.contentHash`(已有,Spec §5.1)判脏,只对脏文件 `resolveCalls` 重抽;`StructureNode`/`Module` 加 `origin`(ast/llm)字段保留 LLM 产物。
- **迁移**:相关表加 `origin String?`;`pnpm db:migrate`。
- **验证**:改一个文件→断言只重抽该文件符号、LLM 产物(`FileSummary`/`Module`)保留、无悬空边。反向 BFS 服务 Agent Bar"改这个函数会影响什么"(PRD 流程五)。
- **优先级**:P1,不阻塞 MVP;先把全量跑顺再上。

### WP-C3 ⌥2 LOD 折叠 + 中心节点 callers/callees
- **借鉴源**:pyan `callgraph.py:128-209`(`filter_by_depth`)、`211-293`(`get_related_nodes` up/down)。GPL,**算法重写**。
- **Glint 落点**:`lib/understand` 调用图查询加"以某符号为中心、深度 N、方向 callers/callees"参数;⌥2 支持模块级↔函数级折叠。`visgraph.py:10-72` 的 HSL 上色(hue=文件)可套 React Flow 节点配色避免随机色(P2)。
- **验证**:e2e 断言"以 requireUser 为中心 depth=1 callers"只含 getProfile。

---

## Phase E — ⌥4 分层下钻(P1,确定性部分可搬)

### WP-E1 下钻规则 + dotted ID(确定性纯函数)
- **借鉴源**:codeboarding `planner_agent.py:33-91`(`should_expand_component`,零 LLM)、`agent_responses.py:370-413`(dotted-prefix `1→1.1→1.1.1`,`only_new` 增量编号)。
- **Glint 落点**:新 `lib/pregen/expand-rules.ts`(两个确定性纯函数重写成 TS);`ArchPanel` 支持"点模块→展开下一层 = 切换渲染子分析"。无 cluster 时**退化为按目录分层**(对 MVP 足够),刚加的角色分层可作为第一层。
- **验证**:对 `archdemo2` 断言 `services` 可展开为 `userService`/`billing`,dotted id 正确。
- **不做**:codeboarding 的 seeded Leiden 聚类(`cluster_delta.py`)依赖 Python `leidenalg` + LSP,与"纯 TS + tree-sitter"路线冲突(清单 #14),**MVP 不引入**,先用目录边界 + `call_edges` 聚合兜底。

---

## 执行顺序与依赖

```
Phase A (WP-A1 → A2)          ← 无 key 可完整验证,推荐先做;A2 依赖 A1
   │
   ├─ Phase B (B1 → B2 → B3)  ← B1 无 key 可验;B2 需 key;B3 便宜可随时插
   │      (B2 无 key 时降级到 E1)
   │
   ├─ Phase C (C1 独立;C2 依赖 A2 的脏文件解析;C3 依赖 A2 的边数据)
   │
   └─ Phase E (E1 独立,可与 A 并行)
```

**建议落地批次**:
1. **批次 1(本周,无 key)**:WP-A1 + A2 + B1。直接提升 ⌥2 准确性 + 备好结构图 schema/校验。全程 e2e 可验。
2. **批次 2**:WP-B3(SSE 事件)+ C1(detect 开关)+ E1(分层下钻)。都便宜、确定性、提升体验。
3. **批次 3(填 key 后)**:WP-B2 端到端跑通 LLM 出图重试。
4. **批次 4(规模上来再做)**:WP-C2 增量、C3 LOD。

每批次完成:typecheck → build → e2e(干净 server)→ 浏览器验证 → commit/push。

---

## 一页纸结论
- **先做 Phase A**:import-aware 解析 + this 绑定 + 边置信度。确定性、无 key 可验、直击 ⌥2 当前会"按全局名误连同名函数"的真 bug。`CallEdge` 加 `confidence` 列。
- **同期备 Phase B1**:`lib/structure/` 的 schema + 校验(照搬 gitdiagram,加行号),为"LLM 出结构化图、确定性校验路径、反馈重试"打地基;LLM 部分待 key。
- **不被带偏**:seeded Leiden + LSP(#14)现在不做;其确定性下钻规则(#11)单独摘出重写,目录分层兜底。
