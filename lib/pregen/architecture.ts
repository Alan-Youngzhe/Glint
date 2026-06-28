import { prisma } from "@/lib/db";
import type { ArchitecturePayload, ArchModule, ArchRole, TreemapNode } from "@/types/contract";

const ENTRY_RE = /^(index|main|app)\.[a-z]+$/i;

/** 由 StructureNode + Module + ProjectAnalysis 组装 ⌥4 架构地图（直读，第二次打开走库）。 */
export async function getArchitecture(
  projectId: string,
): Promise<ArchitecturePayload> {
  const [project, nodes, analysis, moduleRows, files] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
    prisma.structureNode.findMany({
      where: { projectId },
      select: { relPath: true, parentId: true, kind: true, name: true, loc: true },
    }),
    prisma.projectAnalysis.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.module.findMany({ where: { projectId } }),
    prisma.file.findMany({ where: { projectId }, select: { id: true, relPath: true, loc: true } }),
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
    name: project?.name ?? "Project",
    kind: "dir",
    loc: totalLoc,
    children: roots,
  };

  const entryPoints = valid
    .filter((n) => n.kind === "file" && ENTRY_RE.test(n.name))
    .map((n) => n.relPath);
  const techStack = (analysis?.techStack as string[] | null) ?? [];

  // 模块地图：每个模块的体量（loc/文件数）、入口、依赖、可点开的代表文件
  const fileById = new Map(files.map((f) => [f.id, f]));
  const modules: ArchModule[] = moduleRows
    .map((m): ArchModule => {
      const ids = (m.fileIds as string[] | null) ?? [];
      const mf = ids.map((id) => fileById.get(id)).filter((f): f is NonNullable<typeof f> => !!f);
      const top = [...mf].sort((a, b) => b.loc - a.loc)[0];
      return {
        name: m.name,
        pathScope: m.pathScope ?? "",
        role: ((m.businessRole as ArchRole | null) ?? "other"),
        loc: mf.reduce((s, f) => s + f.loc, 0),
        fileCount: mf.length,
        isEntry: m.isEntry,
        uses: (m.dependsOn as string[] | null) ?? [],
        topFile: top?.relPath ?? "",
      };
    })
    .filter((m) => m.fileCount > 0)
    .sort((a, b) => b.loc - a.loc);

  return {
    kind: "architecture",
    focus: { type: "folder", ref: "" },
    root,
    modules,
    techStack,
    overview: {
      summary: analysis?.architectureOverview ?? "(not analyzed yet)",
      entryPoints,
      readingGuide: entryPoints.length
        ? [`Start from the entry ${entryPoints[0]}`, "Then each top-level dir's role", "Click a block to drill into files"]
        : ["Click a block to see each part's size and files"],
    },
  };
}
