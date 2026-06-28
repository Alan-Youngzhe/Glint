import type { ArchModule, ArchRole } from "@/types/contract";
import type { DiagramGraph, DiagramGraphNode, DiagramGraphEdge } from "./schema";

/**
 * 确定性来源：把 Glint 已有的模块地图（ArchModule[] + uses 依赖）编成结构化图。
 * 无需 LLM key 即可产出 gitdiagram 风格的分组架构图；填 key 后可由 LLM 产更丰富的版本。
 * 组 = 角色层（Interface/Logic/Data/Shared/Other），节点 = 模块，边 = uses 依赖。
 */

const ROLE_ORDER: ArchRole[] = ["interface", "logic", "data", "shared", "other"];
const ROLE_LABEL: Record<ArchRole, string> = {
  interface: "Interface",
  logic: "Logic",
  data: "Data",
  shared: "Shared",
  other: "Other",
};

/** 模块名 → 合法 mermaid id（^[a-z][a-z0-9_]*$）。 */
function moduleNodeId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `m_${slug || "root"}`;
}

export function archToDiagramGraph(modules: ArchModule[]): DiagramGraph {
  const present = ROLE_ORDER.filter((r) => modules.some((m) => m.role === r));
  const groups = present.map((r) => ({
    id: r,
    label: ROLE_LABEL[r],
    description: null,
  }));

  const idByName = new Map(modules.map((m) => [m.name, moduleNodeId(m.name)]));

  const nodes: DiagramGraphNode[] = modules.map((m) => ({
    id: idByName.get(m.name)!,
    label: `${m.isEntry ? "▶ " : ""}${m.name === "(root)" ? "(root files)" : m.name}`,
    type: `${m.fileCount} file${m.fileCount === 1 ? "" : "s"} · ${m.loc} LOC`,
    groupId: m.role,
    path: m.topFile || null,
    shape: m.role === "data" ? "database" : "box",
    startLine: null,
    endLine: null,
  }));

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: DiagramGraphEdge[] = [];
  for (const m of modules) {
    const from = idByName.get(m.name)!;
    for (const used of m.uses) {
      const to = idByName.get(used);
      if (to && nodeIds.has(to) && to !== from) {
        edges.push({ from, to, label: "uses", style: "solid" });
      }
    }
  }

  return { groups, nodes, edges };
}
