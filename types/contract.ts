/**
 * 前后端契约 —— 唯一接缝（施工手册 §9 / Spec §6）。
 * 前端 mock 与后端实现都依赖这一份定义；跨前后端的形状一律从此 import，禁止两处各写。
 */

// ===== Focus =====
export type FocusType =
  | "folder"
  | "file"
  | "module"
  | "function"
  | "class"
  | "variable"
  | "selection";

export interface Selection {
  fileId: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface Focus {
  type: FocusType;
  /** 稳定 id，如 "auth/guard.ts#requireUser" / 文件路径 / 模块 id */
  ref: string;
  /** 仅 type==='selection' */
  selection?: Selection;
}

export type Dimension = 1 | 2 | 3 | 4;

// ===== Request =====
/** ⌥2 调用图视图选项：深度（N 跳）+ 层级（函数级 / 模块级折叠）。 */
export interface GraphView {
  depth: number; // 1–3 跳
  level: "function" | "module";
}

export interface UnderstandRequest {
  projectId: string;
  focus: Focus;
  dimension: Dimension;
  graph?: Partial<GraphView>; // 仅 ⌥2 用
}

// ===== ⌥1 卡片 =====
export interface CodeExplanation {
  // 选中代码（实时，Spec §7.4）
  language?: string;
  syntax?: string[];
  lineByLine?: { lines: string; explain: string; why: string }[];
  positionInContext?: string;
  role?: string;
  concepts?: { slug: string; name: string; confidence: number }[];
  generalization?: { where: string; note: string }[];
}

export interface VariableRefs {
  // 变量（AST，确定性）
  definedAt: string;
  reads: number;
  writes: number;
  usedBy: { symbol: string; at: string }[];
}

export interface CardPayload {
  kind: "card";
  focus: Focus;
  title: string;
  /** file/module/function/class 的角色说明 */
  summary?: string;
  /** selection 维度的逐行解释 */
  explanation?: CodeExplanation;
  /** variable 维度的引用聚合 */
  variableRefs?: VariableRefs;
  source: "realtime" | "file_summaries" | "modules" | "symbol_card" | "ast";
  canPin?: boolean;
  drillTo?: { scope: string };
}

// ===== ⌥2 调用图 / ⌥3 执行路径 =====
export interface GraphNode {
  id: string;
  label: string;
  kind: "function" | "class" | "module" | "file";
  isFocus?: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: "calls" | "imports" | "depends";
  nl?: string;
  confidence?: number; // 调用边解析置信度（<0.5 为弱推断，前端虚线弱化）
}

export interface CallGraphPayload {
  kind: "callgraph";
  focus: Focus;
  nodes: GraphNode[];
  edges: GraphEdge[];
  source: string;
  view?: GraphView; // 应用的深度/层级，供 UI 回显
}

export interface ExecStep {
  order: number;
  symbol: string;
  at: string;
  describe: string;
}

export interface ExecPathPayload {
  kind: "execpath";
  focus: Focus;
  steps: ExecStep[];
  note?: string;
  source: string;
}

// ===== ⌥4 架构 Treemap =====
export interface TreemapNode {
  id: string;
  name: string;
  kind: "dir" | "file" | "module";
  loc: number;
  children?: TreemapNode[];
}

/** 模块在系统里扮演的角色（确定性推断，决定它落在哪一层）。 */
export type ArchRole = "interface" | "logic" | "data" | "shared" | "other";

/** 一个模块（顶层代码分区）+ 它的体量与依赖——架构地图的主单位。 */
export interface ArchModule {
  name: string;
  pathScope: string; // 相对路径前缀（"(root)" 模块为空）
  role: ArchRole;
  loc: number;
  fileCount: number;
  isEntry: boolean; // 含入口文件（index/main/app）
  uses: string[]; // 依赖的其他模块名（来自 call_edges 聚合）
  topFile: string; // 模块内最大的文件，点击即打开
}

export interface ArchitecturePayload {
  kind: "architecture";
  focus: Focus;
  root: TreemapNode;
  modules: ArchModule[];
  overview: { summary: string; entryPoints: string[]; readingGuide: string[] };
  techStack: string[];
}

export type UnderstandResponse =
  | CardPayload
  | CallGraphPayload
  | ExecPathPayload
  | ArchitecturePayload;

// ===== 浏览 =====
export interface TreeNode {
  id: string;
  name: string;
  path: string;
  kind: "dir" | "file";
  children?: TreeNode[];
}

export interface FileContent {
  content: string;
  lang: string;
}

// ===== 交互事件（成长分析信号） =====
export interface InteractionEvent {
  action:
    | "select"
    | "dim1"
    | "dim2"
    | "dim3"
    | "dim4"
    | "drill"
    | "recall"
    | "agent";
  focusType: FocusType;
  focusRef: string;
  level?: "arch" | "module" | "code";
  dwellMs?: number;
  ts: string;
}

// ===== UI 动作（Option 与 Agent 共用，V3 §6.8 / §7.3） =====
export type UIAction =
  | { kind: "open_panel"; panel: "call" | "flow" | "arch" | "techstack" | "agent" }
  | { kind: "focus"; focus: Focus }
  | { kind: "highlight"; panel: string; nodeIds: string[] }
  | { kind: "trigger_dimension"; focus: Focus; dimension: Dimension };

// ===== Agent Bar 流式事件 =====
export interface Citation {
  label: string;
  ref: string;
  kind: "file" | "symbol" | "node";
}
export interface Suggestion {
  text: string;
  action?: UIAction;
}
export type AgentEvent =
  | { type: "token"; delta: string }
  | { type: "citation"; citation: Citation }
  | { type: "action"; action: UIAction }
  | { type: "suggestion"; suggestions: Suggestion[] }
  | { type: "done"; messageId: string };
export interface AgentRequest {
  projectId: string;
  sessionId?: string;
  message: string;
}

// ===== 泛化检索（四期 B · V4 §8） =====
export interface SimilarHit {
  ref: string;
  at: string;
  similarity: number;
  note?: string;
}
export interface GeneralizeResult {
  focus: Focus;
  hits: SimilarHit[];
}

// ===== 成长分析（四期 D · V4 §8） =====
export interface WeakPoint {
  slug: string;
  name: string;
  askCount: number;
  trend: "up" | "down" | "flat";
  mastery: number;
}

/** 来源标签（DS §15.3）：把 CardPayload.source 映射成给小白的信任/成本信号。 */
export function provenanceLabel(s: CardPayload["source"]): string {
  return {
    realtime: "Realtime · AI",
    file_summaries: "Prebuilt · cached",
    modules: "Prebuilt · cached",
    ast: "AST · exact",
    symbol_card: "Lazy · cached",
  }[s];
}

// ===== ⌥1 选中代码的流式增量（SSE） =====
export type UnderstandStreamChunk =
  | { delta: string }
  | { done: CardPayload };

// ===== 技术栈（二期 · V2 §3.1） =====
export interface TechItem {
  slug: string;
  name: string;
  kind: "language" | "framework" | "library" | "tool" | "datastore";
  version?: string;
  role?: string; // 在本仓库的角色
  usageRefs?: { at: string }[]; // 使用处（可跳转）
}

export interface TechLiteracy {
  // 项目无关的通用认知（全局缓存）
  slug: string;
  name: string;
  what: string;
  purpose: string;
  ecosystemPosition: string;
}
