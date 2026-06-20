import { prisma } from "@/lib/db";
import { runTaskSafe } from "@/lib/ai";

/**
 * 预理解（V2 §5.2）：确定性骨架（结构/模块/关系/架构）+ LLM 可选补人话（无 key 降级）。
 * 模块关系来自 call_edges 确定性聚合，模型只翻译成人话——不让模型瞎编结构。
 */

export interface PregenResult {
  structureNodes: number;
  modules: number;
}

const ENTRY_RE = /^(index|main|app)\.[a-z]+$/i;

function topModuleOf(relPath: string): string {
  const i = relPath.indexOf("/");
  return i === -1 ? "(root)" : relPath.slice(0, i);
}

export async function pregenProject(projectId: string): Promise<PregenResult> {
  const files = await prisma.file.findMany({
    where: { projectId },
    select: { id: true, relPath: true, loc: true, sizeBytes: true },
  });

  // ── 清旧（可重入）──
  await prisma.structureNode.deleteMany({ where: { projectId } });
  await prisma.edgeExplanation.deleteMany({ where: { projectId } });
  await prisma.module.deleteMany({ where: { projectId } });
  await prisma.projectAnalysis.deleteMany({ where: { projectId } });

  // ── StructureNode：镜像文件树（dir/file，dir loc = 子项求和）──
  interface SN {
    id: string;
    parentId: string | null;
    kind: "dir" | "file";
    name: string;
    relPath: string;
    loc: number;
    sizeBytes: number;
  }
  const nodes = new Map<string, SN>();
  const ensureDir = (rel: string): string | null => {
    if (!rel) return null;
    if (!nodes.has(rel)) {
      const idx = rel.lastIndexOf("/");
      const name = idx === -1 ? rel : rel.slice(idx + 1);
      const parent = idx === -1 ? null : rel.slice(0, idx);
      if (parent) ensureDir(parent);
      nodes.set(rel, { id: rel, parentId: parent, kind: "dir", name, relPath: rel, loc: 0, sizeBytes: 0 });
    }
    return rel;
  };
  for (const f of files) {
    const idx = f.relPath.lastIndexOf("/");
    const parent = idx === -1 ? null : f.relPath.slice(0, idx);
    if (parent) ensureDir(parent);
    nodes.set(f.relPath, {
      id: f.relPath,
      parentId: parent,
      kind: "file",
      name: idx === -1 ? f.relPath : f.relPath.slice(idx + 1),
      relPath: f.relPath,
      loc: f.loc,
      sizeBytes: f.sizeBytes,
    });
  }
  // dir loc 求和（自底向上：按路径深度降序累加到父）
  const sorted = [...nodes.values()].sort(
    (a, b) => b.relPath.split("/").length - a.relPath.split("/").length,
  );
  for (const n of sorted) {
    if (n.parentId) {
      const p = nodes.get(n.parentId)!;
      p.loc += n.loc;
      p.sizeBytes += n.sizeBytes;
    }
  }
  await prisma.structureNode.createMany({
    data: [...nodes.values()].map((n) => ({
      projectId,
      parentId: n.parentId,
      kind: n.kind,
      name: n.name,
      relPath: n.relPath,
      loc: n.loc,
      sizeBytes: n.sizeBytes,
    })),
  });

  // ── 模块：按顶层目录聚类 ──
  const moduleFiles = new Map<string, { id: string; relPath: string; loc: number }[]>();
  for (const f of files) {
    const m = topModuleOf(f.relPath);
    const arr = moduleFiles.get(m) ?? [];
    arr.push(f);
    moduleFiles.set(m, arr);
  }

  // 模块关系：call_edges 跨模块聚合（确定性）
  const symbols = await prisma.symbol.findMany({
    where: { projectId },
    select: { id: true, fileId: true },
  });
  const fileById = new Map(files.map((f) => [f.id, f.relPath]));
  const moduleBySymbol = new Map<string, string>();
  for (const s of symbols) {
    const rel = fileById.get(s.fileId);
    if (rel) moduleBySymbol.set(s.id, topModuleOf(rel));
  }
  const edges = await prisma.callEdge.findMany({
    where: { projectId },
    select: { callerSymbolId: true, calleeSymbolId: true, refCount: true },
  });
  const deps = new Map<string, Map<string, number>>(); // module → (depModule → count)
  for (const e of edges) {
    const from = moduleBySymbol.get(e.callerSymbolId);
    const to = moduleBySymbol.get(e.calleeSymbolId);
    if (from && to && from !== to) {
      const m = deps.get(from) ?? new Map();
      m.set(to, (m.get(to) ?? 0) + e.refCount);
      deps.set(from, m);
    }
  }

  // ── 架构概述（LLM 可选）──
  const moduleNames = [...moduleFiles.keys()];
  const overviewLLM = await runTaskSafe("module_arch", [
    {
      role: "system",
      content: "你是资深架构讲解者。用 2-3 句中文概述这个项目的整体结构，面向非技术读者。",
    },
    {
      role: "user",
      content: `模块：${moduleNames.join(", ")}。文件数：${files.length}。模块依赖：${[...deps.entries()].map(([a, m]) => `${a}→${[...m.keys()].join("/")}`).join("; ") || "无"}。`,
    },
  ]);
  const overview =
    overviewLLM ??
    `项目含 ${moduleNames.length} 个模块（${moduleNames.join("、")}），共 ${files.length} 个文件。`;

  // 写 Module
  for (const [name, mf] of moduleFiles) {
    const depMap = deps.get(name);
    const dependsOn = depMap ? [...depMap.keys()] : [];
    const isEntry = mf.some((f) => {
      const base = f.relPath.split("/").pop() ?? "";
      return ENTRY_RE.test(base);
    });
    await prisma.module.create({
      data: {
        projectId,
        name,
        pathScope: name === "(root)" ? "" : name,
        responsibility: `包含 ${mf.length} 个文件`,
        isEntry,
        dependsOn,
        fileIds: mf.map((f) => f.id),
      },
    });
    // 关系解释（确定性）
    if (depMap) {
      for (const [to, count] of depMap) {
        await prisma.edgeExplanation.create({
          data: {
            projectId,
            sourceRef: name,
            targetRef: to,
            relationType: "depends",
            nlExplanation: `${name} 调用 ${to}（${count} 处）`,
          },
        });
      }
    }
  }

  // ── ProjectAnalysis ──
  const techItems = await prisma.techStackItem.findMany({
    where: { projectId },
    select: { name: true, kind: true },
  });
  await prisma.projectAnalysis.create({
    data: {
      projectId,
      version: 1,
      architectureOverview: overview,
      techStack: techItems.map((t) => t.name),
      frameworks: techItems.filter((t) => t.kind === "framework").map((t) => t.name),
    },
  });

  return { structureNodes: nodes.size, modules: moduleFiles.size };
}
