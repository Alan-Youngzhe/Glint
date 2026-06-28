import dagre from "dagre";
import type { GraphEdge, GraphNode } from "@/types/contract";

export const NODE_W = 168;
export const NODE_H = 46;

export interface LaidNode extends GraphNode {
  x: number;
  y: number;
}

/** dagre 分层布局（V3 §6.5 / DS §9.14）：调用者上、被调用者下、不重叠。 */
export function layoutDag(
  nodes: GraphNode[],
  edges: GraphEdge[],
  rankdir: "TB" | "LR" = "TB",
): LaidNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir, nodesep: 36, ranksep: 64, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));

  const ids = new Set(nodes.map((n) => n.id));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => {
    if (ids.has(e.from) && ids.has(e.to)) g.setEdge(e.from, e.to);
  });

  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 };
  });
}
