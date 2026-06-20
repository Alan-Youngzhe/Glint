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
export interface UnderstandRequest {
  projectId: string;
  focus: Focus;
  dimension: Dimension;
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
}

export interface CallGraphPayload {
  kind: "callgraph";
  focus: Focus;
  nodes: GraphNode[];
  edges: GraphEdge[];
  source: string;
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

export interface ArchitecturePayload {
  kind: "architecture";
  focus: Focus;
  root: TreemapNode;
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
  action: "select" | "dim1" | "dim2" | "dim3" | "dim4" | "drill" | "recall";
  focusType: FocusType;
  focusRef: string;
  level?: "arch" | "module" | "code";
  dwellMs?: number;
  ts: string;
}

// ===== ⌥1 选中代码的流式增量（SSE） =====
export type UnderstandStreamChunk =
  | { delta: string }
  | { done: CardPayload };
