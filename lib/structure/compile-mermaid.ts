import type { DiagramGraph, DiagramGraphNode, DiagramGraphEdge } from "./schema";

/**
 * 结构化图 → Mermaid flowchart 字符串（照抄 gitdiagram src/server/generate/graph.ts，MIT）。
 * 与 gitdiagram 的差异：不发 GitHub blob `click` 指令——改成返回 nodeId→path 映射，
 * 由渲染组件在 app 内绑定点击（打开本地文件 + 行号）。
 */

export interface CompiledDiagram {
  mermaid: string;
  /** mermaid 节点 id（node_xxx）→ { path, startLine }，渲染后用于点击打开。 */
  pathByMermaidId: Map<string, { path: string; startLine: number | null }>;
}

function escapeMermaidText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').trim();
}

function mermaidNodeId(nodeId: string): string {
  return `node_${nodeId}`;
}
function mermaidGroupId(groupId: string): string {
  return `group_${groupId}`;
}

function labelForNode(node: DiagramGraphNode): string {
  const primary = escapeMermaidText(node.label);
  const detail = node.type ? escapeMermaidText(node.type) : null;
  return [primary, detail].filter(Boolean).join("<br/>");
}

function renderNode(node: DiagramGraphNode): string {
  const label = labelForNode(node);
  const id = mermaidNodeId(node.id);
  switch (node.shape ?? "box") {
    case "database":
      return `${id}[("${label}")]`;
    case "circle":
      return `${id}(("${label}"))`;
    case "hexagon":
      return `${id}{{"${label}"}}`;
    default:
      return `${id}["${label}"]`;
  }
}

function renderEdge(edge: DiagramGraphEdge): string {
  const connector = edge.style === "dashed" ? "-.->" : "-->";
  const from = mermaidNodeId(edge.from);
  const to = mermaidNodeId(edge.to);
  if (!edge.label) return `${from} ${connector} ${to}`;
  return `${from} ${connector}|"${escapeMermaidText(edge.label)}"| ${to}`;
}

const toneClassNames = [
  "toneBlue",
  "toneAmber",
  "toneMint",
  "toneRose",
  "toneIndigo",
  "toneTeal",
] as const;

function toneClassForGroup(
  groupId: string | null | undefined,
  groupOrder: Map<string, number>,
): string {
  if (!groupId) return "toneNeutral";
  const i = groupOrder.get(groupId);
  if (i === undefined) return "toneNeutral";
  return toneClassNames[i % toneClassNames.length] ?? "toneNeutral";
}

export function compileDiagramGraph(graph: DiagramGraph): CompiledDiagram {
  const lines: string[] = ["flowchart TD"];
  const grouped = new Set<string>();
  const classAssignments = new Map<string, string[]>();
  const groupOrder = new Map<string, number>(graph.groups.map((g, i) => [g.id, i] as [string, number]));
  const pathByMermaidId = new Map<string, { path: string; startLine: number | null }>();

  const pushNode = (node: DiagramGraphNode, indent = "") => {
    lines.push(`${indent}${renderNode(node)}`);
    const cls = toneClassForGroup(node.groupId, groupOrder);
    classAssignments.set(cls, [...(classAssignments.get(cls) ?? []), node.id]);
    if (node.path) {
      pathByMermaidId.set(mermaidNodeId(node.id), { path: node.path, startLine: node.startLine });
    }
  };

  for (const group of graph.groups) {
    lines.push("");
    lines.push(`subgraph ${mermaidGroupId(group.id)}["${escapeMermaidText(group.label)}"]`);
    for (const node of graph.nodes.filter((n) => n.groupId === group.id)) {
      pushNode(node, "  ");
      grouped.add(node.id);
    }
    lines.push("end");
  }

  const ungrouped = graph.nodes.filter((n) => !grouped.has(n.id));
  if (ungrouped.length) {
    lines.push("");
    for (const n of ungrouped) pushNode(n);
  }

  if (graph.edges.length) {
    lines.push("");
    for (const e of graph.edges) lines.push(renderEdge(e));
  }

  lines.push("");
  lines.push("classDef toneNeutral fill:#f8fafc,stroke:#334155,stroke-width:1.5px,color:#0f172a");
  lines.push("classDef toneBlue fill:#dbeafe,stroke:#2563eb,stroke-width:1.5px,color:#172554");
  lines.push("classDef toneAmber fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#78350f");
  lines.push("classDef toneMint fill:#dcfce7,stroke:#16a34a,stroke-width:1.5px,color:#14532d");
  lines.push("classDef toneRose fill:#ffe4e6,stroke:#e11d48,stroke-width:1.5px,color:#881337");
  lines.push("classDef toneIndigo fill:#e0e7ff,stroke:#4f46e5,stroke-width:1.5px,color:#312e81");
  lines.push("classDef toneTeal fill:#ccfbf1,stroke:#0f766e,stroke-width:1.5px,color:#134e4a");

  for (const [cls, ids] of classAssignments) {
    if (!ids.length) continue;
    lines.push(`class ${ids.map(mermaidNodeId).join(",")} ${cls}`);
  }

  return { mermaid: lines.join("\n").trim(), pathByMermaidId };
}
