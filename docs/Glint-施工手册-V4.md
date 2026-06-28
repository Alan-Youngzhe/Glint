# Glint 施工手册 V4（四期工程）

| 项目 | 内容 |
| --- | --- |
| 版本 | v1.0 |
| 期次 | **四期**（M4 扩展与上线）—— 主链路稳定后做 |
| 状态 | 可执行 · 承接三期主链路 |
| 最后更新 | 2026-06-20 |
| 关联 | 《Glint-PRD.md》v0.8 ·《Glint-技术Spec.md》v0.6 ·《Glint-施工手册.md》(总参考) ·《Glint-施工手册-V2.md》·《Glint-施工手册-V3.md》·《design-system/Glint-Design-System.md》 |
| 执行者 | 下一个 AI 编码 agent |

> 四期是**增强与上线**：把三期打通的主链路做深、做广、做成可分享给他人的产品。五个相对独立的模块（A–E），可按需取舍、并行推进。

---

## 0. 期次定位

| 期 | 范围 | 状态 |
| --- | --- | --- |
| 一/二/三期 | M0 骨架 / M1+M2 浏览+预理解 / M3 四维交互+Agent Bar | ✅ |
| **四期** | M4：⌥3 深化 · 泛化检索 · 全量 RAG · 成长分析 · 上线 | ▶ **本手册** |

四期五模块（**相对独立、可并行**）：
- **A** ⌥3 执行路径深化
- **B** 泛化检索（相同/相似写法）
- **C** 全量向量 RAG（Agent 检索底座）
- **D** 成长分析（弱项看板）
- **E** 上线（GitHub 导入 / 多用户 / 前端 Key 配置）

> 优先级建议：B/C 一起做（共用 `code_chunks` + pgvector，给 Agent 和泛化都供血）→ D（差异化护城河）→ A（体验打磨）→ E（要分享给他人时再做）。

---

## 1. 现状盘点（三期后）

- 主链路已通：四维交互 + Agent Bar + 轨迹 + 记录/事件入库。
- `db`：`CodeChunk` 表已建（**无 embedding 列**，本期启用 pgvector 再加）；`UserConceptStat` 表已建（待物化）；`User`/多用户外键已预留；`InteractionEvent`/`QueryConceptTag` 已在采集。
- `lib/agent` 的 `retrieve` 工具目前用 symbol/结构兜底——本期 C 把它换成真 RAG。
- Agent/四维契约齐备；`lib/api` real 已接 understand/agent。

---

## 2. 四期总目标与 DoD（按模块）
见各模块末尾 DoD。整体「完成」＝ B+C+D 落地（产品从「解释器」真正变「教练」），A 体验达标，E 视是否上线决定。

---

## 3. 模块 A · ⌥3 执行路径深化

**现状**：三期 ⌥3 是「call_edges 静态 trace + LLM 叙述（标近似）」。**目标**：更准、更稳。
- **跨文件/动态调用**：补 import 解析 + 简单类型/形参传播，减少漏边；动态分发（高阶函数/回调/事件）标注「可能路径」而非漏掉。
- **trace 起点策略**：从入口函数（路由/事件处理）或当前焦点出发，按调用深度截断（默认 ≤N 层，可展开）。
- **泳道归属**：节点按所属模块/层分泳道（DS §15.5 ⌥3），「循环 × items」「并发」「错误分支」用统一标记。
- **缓存**：按焦点写 `dimension_cache(dimension=3)`；焦点相关文件变更才失效。
- **降级**：无 grammar / 解析不确定的语言，给「基于摘要的叙述版」并明确标注。

**DoD**：主流语言（TS/JS/Python）对清晰业务流程（如「创建订单」）给出正确步骤泳道；不确定处明确标注；二次查直读缓存。

---

## 4. 模块 B · 泛化检索（相同/相似写法）

回应 ⌥1「同类写法在别处哪里也出现」（PRD §4.4），把一次性理解升级为可迁移认知。
1. **分块 + 指纹**（`lib/parse` 扩展，写 `code_chunks`）：按函数/语句切块；tree-sitter 归一化（变量名抽象化、保留结构）得 `astFingerprint`；存 `normalizedText`。
2. **嵌入**（启用 pgvector）：给 `code_chunks` 加 `embedding`（见 §7 schema）；`lib/ai` 的 `embed` 批量生成（廉价档），ivfflat/hnsw 索引。
3. **检索**（`app/api/search/generalize`，回填 `GlintApi.search`）：结构路（`astFingerprint` 同类）+ 语义路（pgvector 近邻）双召回合并去重；可选廉价模型给「为什么相似/不同」一句话。
4. **接入 ⌥1 卡**：selection/function 焦点的浮卡底部加「相似写法 N 处 →」，点开列出位置 + 差异（DS §15.4 动作区）。

**DoD**：选中一处写法 → 列出项目中相同/相似处及差异；⌥1 卡可附泛化入口。

---

## 5. 模块 C · 全量向量 RAG（Agent 检索底座）

把三期 Agent 的 `retrieve` 从兜底换成真 RAG，并支撑自由提问全库检索。
- **底座复用 B**：`code_chunks` + `embedding`（与泛化共用一套）。再补**摘要级嵌入**（`file_summaries`/`modules` 也嵌入），让检索能命中「业务概念」而非只代码字面。
- **检索管线**（`lib/rag`）：query 嵌入 → pgvector 近邻（代码块 + 摘要）+ 关键词兜底 → 重排 → 拼上下文。
- **接 Agent**：`lib/agent` 的 `retrieve` 工具改调 `lib/rag`；答案引用回 `code_chunks`/文件（Citation）。
- **成本/隐私**：嵌入走廉价档 + 批处理；命中缓存；隐私同 Spec §（片段发第三方模型，设置可选厂商）。

**DoD**：Agent Bar 问「这个项目怎么做鉴权的？」能跨文件检索相关代码+摘要、综合回答并附可跳转引用；自由提问不再受单焦点限制。

---

## 6. 模块 D · 成长分析（弱项看板）—— 差异化护城河

把已采集的**概念标签 + 交互轨迹**变成「个人化代码学习教练」。
1. **物化统计**（`worker` 定时 / 触发）：聚合 `query_concept_tags`（按概念的提问频次）+ `interaction_events`（反复 Option 同类对象、在哪层钉住、哪些反复回看）→ 写 `UserConceptStat`（`askCount`/`dimCounts`/`trend`/`masterySignal`）。
2. **弱项识别**：高频 + 反复 + 低掌握信号的概念＝弱项；趋势是否收敛。
3. **补强建议**：对弱项推荐「重读项目中相关实例（接模块 B 泛化）/ 生成专题讲解（调 AI）」。
4. **看板**（`components/insights/WeakBoard` + `app/api/insights/weak-points` 回填 `GlintApi.weakPoints`）：按概念聚合的频次/趋势/掌握度，Edge bar「成长」入口；视觉走 DS（中性 + 电蓝，数据用蓝阶，不彩虹）。

**DoD**：看板按概念展示弱项与趋势；给出针对性补强入口；交互轨迹确实在驱动结论（非仅问答）。

---

## 7. 模块 E · 上线（服务他人）

把个人自用变可分享。**只在要给他人用时做**（PRD：MVP 不做）。
- **GitHub 导入**（PRD F25 / Spec P2）：OAuth 授权、私有仓库权限、token 管理；`projects.source_type=github`，clone/拉取后走同一索引/预理解管线。
- **多用户**：接 NextAuth（或同类）；`User` 已在，补会话与**数据隔离**（所有查询按 `userId`/`projectId` 过滤）；删项目即删其代码与记录（级联已设）。
- **前端模型/Key 配置**：把后端 env 的模型/厂商/成本上限搬到前端设置页（每用户自己的 Key，加密存储）；沿用 `lib/ai` 的 TaskProfile 抽象。
- **部署**：长驻容器（Railway/Render/Fly）+ 托管 Postgres(+pgvector)；Worker 进程；对象存储放上传代码。

**DoD**：他人能用自己的 GitHub + 自己的 Key 跑通主链路；数据互相隔离；删项目数据干净。

---

## 8. 契约 / schema 增量（四期）

**契约（`types/contract.ts`）**
```ts
// 泛化检索（B）
export interface SimilarHit { ref:string; at:string; similarity:number; note?:string; }
export interface GeneralizeResult { focus:Focus; hits:SimilarHit[]; }
// 成长分析（D）
export interface WeakPoint { slug:string; name:string; askCount:number; trend:"up"|"down"|"flat"; mastery:number; }
// GlintApi 追加：
//   search(req:{projectId:string; focus:Focus}): Promise<GeneralizeResult>;
//   weakPoints(userId:string): Promise<WeakPoint[]>;
```
**schema（`db/schema.prisma`）**
```prisma
// B/C：启用 pgvector 后给 CodeChunk 加向量列（Prisma 用 Unsupported）
model CodeChunk {
  // …已有字段…
  embedding Unsupported("vector(1536)")?     // ivfflat/hnsw 索引（用 SQL 迁移建）
}
// C：摘要级嵌入（可选）—— 复用 code_chunks 或新增 summary_embeddings
// E：多用户已由 User/外键覆盖；Key 配置存 user.settings 或单独 user_secrets（加密）
```
> `embedding` 列与索引需手写 SQL 迁移（pgvector：`CREATE EXTENSION vector;` + `CREATE INDEX ... USING hnsw`）。

---

## 9. 四期验收清单
- [ ] **A** ⌥3 主流语言清晰流程正确、不确定处标注、缓存。
- [ ] **B** 泛化检索：结构+语义双召回；⌥1 卡附「相似写法」。
- [ ] **C** 全量 RAG：Agent retrieve 换真 RAG；自由提问跨库检索带引用。
- [ ] **D** 成长分析：弱项看板 + 补强建议；轨迹驱动。
- [ ] **E** 上线：GitHub+OAuth / 多用户隔离 / 前端 Key（按需）。
- [ ] 契约加 search/weakPoints；schema 启用 embedding 列与索引。

## 10. 四期风险
| 风险 | 应对 |
| --- | --- |
| 嵌入成本（大库） | 廉价档 + 批处理 + 增量（按 hash）+ 软上限；先小库验证 |
| 泛化/RAG 召回质量 | 结构+语义双路 + 重排；摘要级嵌入补「概念」命中 |
| 成长分析「过拟合」误判弱项 | 多信号（频次+反复+掌握）联合；趋势窗口；可人工修正 |
| pgvector 运维 | 用 Neon/Supabase 自带 pgvector；索引用 hnsw；监控召回延迟 |
| 上线隐私/隔离 | 全查询按 userId/projectId；Key 加密；删项目级联；第三方模型片段可选厂商 |
| ⌥3 动态语言精度天花板 | 标注「可能路径」；后续可接 LSP/语言服务增强 |

---

## 修订历史

| 版本 | 日期 | 摘要 |
| --- | --- | --- |
| v1.0 | 2026-06-20 | 四期施工手册首版：M4 五模块（⌥3 深化 / 泛化检索 / 全量 RAG / 成长分析 / 上线），承接三期主链路 + 现有 schema（code_chunks/user_concept_stats）；契约与 schema 增量、各模块步骤与 DoD/风险 |

> 版本管理规范见 `VERSIONING.md`。
