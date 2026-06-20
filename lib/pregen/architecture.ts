import { prisma } from "@/lib/db";
import type { ArchitecturePayload, TreemapNode } from "@/types/contract";

const ENTRY_RE = /^(index|main|app)\.[a-z]+$/i;

/** 由 StructureNode + ProjectAnalysis 组装 ⌥4 架构 Treemap（直读，第二次打开走库）。 */
export async function getArchitecture(
  projectId: string,
): Promise<ArchitecturePayload> {
  const [project, nodes, analysis] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
    prisma.structureNode.findMany({
      where: { projectId },
      select: { relPath: true, parentId: true, kind: true, name: true, loc: true },
    }),
    prisma.projectAnalysis.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // relPath → TreemapNode（relPath 理论非空，guard 以满足类型）
  const valid = nodes.filter(
    (n): n is typeof n & { relPath: string } => n.relPath !== null,
  );
  const byPath = new Map<string, TreemapNode>();
  for (const n of valid) {
    byPath.set(n.relPath, {
      id: n.relPath,
      name: n.name,
      kind: n.kind === "dir" ? "dir" : "file",
      loc: n.loc,
      ...(n.kind === "dir" ? { children: [] } : {}),
    });
  }
  const roots: TreemapNode[] = [];
  for (const n of valid) {
    const tn = byPath.get(n.relPath)!;
    if (n.parentId && byPath.has(n.parentId)) {
      byPath.get(n.parentId)!.children!.push(tn);
    } else {
      roots.push(tn);
    }
  }
  // 目录在前、loc 降序
  const sortRec = (arr: TreemapNode[]) => {
    arr.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return b.loc - a.loc;
    });
    arr.forEach((c) => c.children && sortRec(c.children));
  };
  sortRec(roots);

  const totalLoc = roots.reduce((s, r) => s + r.loc, 0);
  const root: TreemapNode = {
    id: "root",
    name: project?.name ?? "项目",
    kind: "dir",
    loc: totalLoc,
    children: roots,
  };

  const entryPoints = valid
    .filter((n) => n.kind === "file" && ENTRY_RE.test(n.name))
    .map((n) => n.relPath);
  const techStack = (analysis?.techStack as string[] | null) ?? [];

  return {
    kind: "architecture",
    focus: { type: "folder", ref: "" },
    root,
    techStack,
    overview: {
      summary: analysis?.architectureOverview ?? "（尚未预理解）",
      entryPoints,
      readingGuide: entryPoints.length
        ? [`从入口 ${entryPoints[0]} 开始读`, "再看各顶层目录的职责", "点区块下钻看更细的文件"]
        : ["点区块下钻查看各部分规模与文件"],
    },
  };
}
