/**
 * 结构化架构图契约（借鉴 gitdiagram src/features/diagram/graph.ts，MIT）。
 * 让 LLM 产 JSON 而非画 DSL；确定性来源（lib/structure/from-modules）也产同一形状。
 * Glint 改造：节点带 startLine/endLine（tree-sitter 精确行号，点击跳本地编辑器）。
 *
 * 现为纯 TS 类型；LLM 出图的运行时校验（路径命中 + 反馈重试，WP-B2）落地时再补 zod。
 */

export const MAX_GRAPH_GROUPS = 10;
export const MAX_GRAPH_NODES = 40;
export const MAX_GRAPH_EDGES = 60;
export const MAX_GRAPH_LABEL_LENGTH = 72;
export const MAX_GRAPH_ATTEMPTS = 3;

export type DiagramNodeShape = "box" | "database" | "circle" | "hexagon";
export type DiagramEdgeStyle = "solid" | "dashed";

export interface DiagramGraphGroup {
  id: string;
  label: string;
  description: string | null;
}

export interface DiagramGraphNode {
  id: string;
  label: string;
  type: string | null;
  groupId: string | null;
  path: string | null;
  shape: DiagramNodeShape | null;
  startLine: number | null;
  endLine: number | null;
}

export interface DiagramGraphEdge {
  from: string;
  to: string;
  label: string | null;
  style: DiagramEdgeStyle | null;
}

export interface DiagramGraph {
  groups: DiagramGraphGroup[];
  nodes: DiagramGraphNode[];
  edges: DiagramGraphEdge[];
}
