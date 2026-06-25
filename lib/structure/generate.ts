import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { runTaskSafe } from "@/lib/ai";
import { STORAGE_ROOT } from "@/lib/import";
import { getArchitecture } from "@/lib/pregen/architecture";
import { MAX_GRAPH_ATTEMPTS, type DiagramGraph } from "./schema";
import { firstPassMessages, graphPassMessages, type DiagramPromptContext } from "./prompts";
import { parseGraph, validateGraph, formatFeedback, type ValidationContext } from "./validate";

/**
 * WP-B2：LLM 生成架构图（借鉴 gitdiagram 的 LLM→结构图→路径校验→重试链路）。
 * 无 LLM key 时 runTaskSafe 返回 null → 本函数返回 null → 调用方降级到确定性图（from-modules）。
 */

const MAX_TREE_LINES = 300;
const MAX_README = 2000;

async function buildContext(
  projectId: string,
): Promise<(DiagramPromptContext & ValidationContext) | null> {
  const [project, arch, files] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
    getArchitecture(projectId),
    prisma.file.findMany({ where: { projectId }, select: { relPath: true, loc: true } }),
  ]);
  if (!project || files.length === 0) return null;

  const fileLoc = new Map(files.map((f) => [f.relPath, f.loc]));

  // 文件树：浅层优先，截断到上限（大仓库不撑爆 prompt）
  const sorted = [...files]
    .map((f) => f.relPath)
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  const tree = sorted.slice(0, MAX_TREE_LINES).join("\n") +
    (sorted.length > MAX_TREE_LINES ? `\n… (+${sorted.length - MAX_TREE_LINES} more files)` : "");

  const modules = arch.modules
    .map((m) => `- ${m.name} · ${m.role} · ${m.fileCount} files · ${m.loc} LOC${m.uses.length ? ` · uses ${m.uses.join("/")}` : ""}`)
    .join("\n");

  let readme: string | undefined;
  const readmePath = files.find((f) => /(^|\/)readme\.md$/i.test(f.relPath))?.relPath;
  if (readmePath) {
    try {
      readme = (await readFile(path.join(STORAGE_ROOT, projectId, readmePath), "utf8")).slice(0, MAX_README);
    } catch {
      /* ignore */
    }
  }

  return {
    projectName: project.name,
    fileTree: tree,
    modules,
    techStack: arch.techStack.join(", ") || "(none detected)",
    readme,
    fileLoc,
  };
}

export async function generateDiagramGraph(projectId: string): Promise<DiagramGraph | null> {
  const ctx = await buildContext(projectId);
  if (!ctx) return null;

  // 第一遍：大白话解释（无 key → null → 降级）
  const explanation = await runTaskSafe("structure_gen", firstPassMessages(ctx));
  if (!explanation) return null;

  // 第二遍 + 校验重试环
  let feedback: string | undefined;
  let previous: string | undefined;
  for (let attempt = 1; attempt <= MAX_GRAPH_ATTEMPTS; attempt++) {
    const raw = await runTaskSafe("structure_gen", graphPassMessages(ctx, explanation, feedback, previous));
    if (!raw) return null;
    previous = raw;

    const { graph, issues } = parseGraph(raw);
    if (!graph) {
      feedback = formatFeedback(issues);
      continue;
    }
    const { valid, issues: semantic } = validateGraph(graph, { fileLoc: ctx.fileLoc });
    if (valid) return graph;
    feedback = formatFeedback(semantic);
  }

  return null; // 重试用尽 → 降级到确定性图
}
