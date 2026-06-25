import {
  MAX_GRAPH_EDGES,
  MAX_GRAPH_GROUPS,
  MAX_GRAPH_NODES,
  type DiagramEdgeStyle,
  type DiagramGraph,
  type DiagramGraphEdge,
  type DiagramGraphNode,
  type DiagramNodeShape,
} from "./schema";

/**
 * LLM 出图的解析 + 校验（借鉴 gitdiagram src/server/generate/graph.ts，MIT）。
 * 手写校验（不引 zod）：① JSON 解析 + 形状校验；② 语义校验（path/行号命中真实文件、id 唯一、边不悬空）。
 * 校验失败拼成 feedback 喂回 LLM 重试——杜绝幻觉路径。
 */

export interface ValidationContext {
  /** 项目真实文件相对路径 → 行数（loc），用于 path/startLine 校验。 */
  fileLoc: Map<string, number>;
}

const ID_RE = /^[a-z][a-z0-9_]*$/;
const SHAPES: DiagramNodeShape[] = ["box", "database", "circle", "hexagon"];
const STYLES: DiagramEdgeStyle[] = ["solid", "dashed"];

function isStr(v: unknown): v is string {
  return typeof v === "string";
}

/** 去掉 ```json 围栏并解析；返回 graph 或形状 issues。 */
export function parseGraph(raw: string): { graph: DiagramGraph | null; issues: string[] } {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { graph: null, issues: [`graph: not valid JSON — ${e instanceof Error ? e.message : e}`] };
  }
  return validateShape(parsed);
}

function validateShape(parsed: unknown): { graph: DiagramGraph | null; issues: string[] } {
  const issues: string[] = [];
  if (typeof parsed !== "object" || parsed === null) {
    return { graph: null, issues: ["graph: expected a JSON object with groups/nodes/edges"] };
  }
  const obj = parsed as Record<string, unknown>;
  const groupsIn = Array.isArray(obj.groups) ? obj.groups : [];
  const nodesIn = Array.isArray(obj.nodes) ? obj.nodes : [];
  const edgesIn = Array.isArray(obj.edges) ? obj.edges : [];

  if (!Array.isArray(obj.nodes) || nodesIn.length === 0)
    issues.push("nodes: required non-empty array");
  if (nodesIn.length > MAX_GRAPH_NODES) issues.push(`nodes: at most ${MAX_GRAPH_NODES}`);
  if (groupsIn.length > MAX_GRAPH_GROUPS) issues.push(`groups: at most ${MAX_GRAPH_GROUPS}`);
  if (edgesIn.length > MAX_GRAPH_EDGES) issues.push(`edges: at most ${MAX_GRAPH_EDGES}`);

  const groups = groupsIn.map((g, i) => {
    const o = (g ?? {}) as Record<string, unknown>;
    if (!isStr(o.id) || !ID_RE.test(o.id)) issues.push(`groups.${i}.id: must match ^[a-z][a-z0-9_]*$`);
    if (!isStr(o.label) || !o.label.trim()) issues.push(`groups.${i}.label: required`);
    return { id: String(o.id ?? ""), label: String(o.label ?? ""), description: isStr(o.description) ? o.description : null };
  });

  const nodes: DiagramGraphNode[] = nodesIn.map((n, i) => {
    const o = (n ?? {}) as Record<string, unknown>;
    if (!isStr(o.id) || !ID_RE.test(o.id)) issues.push(`nodes.${i}.id: must match ^[a-z][a-z0-9_]*$`);
    if (!isStr(o.label) || !o.label.trim()) issues.push(`nodes.${i}.label: required`);
    if (o.shape != null && !SHAPES.includes(o.shape as DiagramNodeShape))
      issues.push(`nodes.${i}.shape: one of ${SHAPES.join("/")} or null`);
    return {
      id: String(o.id ?? ""),
      label: String(o.label ?? ""),
      type: isStr(o.type) ? o.type : null,
      groupId: isStr(o.groupId) ? o.groupId : null,
      path: isStr(o.path) ? o.path : null,
      shape: (o.shape as DiagramNodeShape) ?? null,
      startLine: typeof o.startLine === "number" ? o.startLine : null,
      endLine: typeof o.endLine === "number" ? o.endLine : null,
    };
  });

  const edges: DiagramGraphEdge[] = edgesIn.map((e, i) => {
    const o = (e ?? {}) as Record<string, unknown>;
    if (!isStr(o.from)) issues.push(`edges.${i}.from: required node id`);
    if (!isStr(o.to)) issues.push(`edges.${i}.to: required node id`);
    if (o.style != null && !STYLES.includes(o.style as DiagramEdgeStyle))
      issues.push(`edges.${i}.style: solid/dashed or null`);
    return {
      from: String(o.from ?? ""),
      to: String(o.to ?? ""),
      label: isStr(o.label) ? o.label : null,
      style: (o.style as DiagramEdgeStyle) ?? null,
    };
  });

  if (issues.length) return { graph: null, issues };
  return { graph: { groups, nodes, edges }, issues: [] };
}

/** 语义校验：path 命中真实文件、startLine 在文件行数内、id 唯一、边两端存在、groupId 已声明。 */
export function validateGraph(
  graph: DiagramGraph,
  ctx: ValidationContext,
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const groupIds = new Set<string>();
  graph.groups.forEach((g, i) => {
    if (groupIds.has(g.id)) issues.push(`groups.${i}.id: duplicate "${g.id}"`);
    groupIds.add(g.id);
  });

  const nodeIds = new Set<string>();
  graph.nodes.forEach((n, i) => {
    if (nodeIds.has(n.id)) issues.push(`nodes.${i}.id: duplicate "${n.id}"`);
    nodeIds.add(n.id);
    if (n.groupId && !groupIds.has(n.groupId))
      issues.push(`nodes.${i}.groupId: unknown group "${n.groupId}"`);
    if (n.path) {
      const loc = ctx.fileLoc.get(n.path);
      if (loc === undefined)
        issues.push(`nodes.${i}.path: "${n.path}" does not exist in the project file tree`);
      else if (n.startLine != null && n.startLine > loc)
        issues.push(`nodes.${i}.startLine: ${n.startLine} exceeds ${n.path} length (${loc} lines)`);
    }
  });

  graph.edges.forEach((e, i) => {
    if (!nodeIds.has(e.from)) issues.push(`edges.${i}.from: unknown node "${e.from}"`);
    if (!nodeIds.has(e.to)) issues.push(`edges.${i}.to: unknown node "${e.to}"`);
  });

  return { valid: issues.length === 0, issues };
}

export function formatFeedback(issues: string[]): string {
  return issues.join("\n");
}
