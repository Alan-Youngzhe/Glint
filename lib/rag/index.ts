import { prisma } from "@/lib/db";
import type { Citation } from "@/types/contract";

export interface RagResult {
  snippets: { ref: string; at: string; text: string }[];
  citations: Citation[];
}

/**
 * 检索底座（V4 §5）。当前：关键词路（code_chunks.normalizedText + 模块职责）确定性召回。
 * 语义路（pgvector 近邻）待 code_chunks.embedding 就绪（需 embedding key）后并入双召回 + 重排。
 */
export async function retrieve(
  projectId: string,
  query: string,
  limit = 6,
): Promise<RagResult> {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9_一-龥]+/)
    .filter((t) => t.length >= 3)
    .slice(0, 6);
  if (!terms.length) return { snippets: [], citations: [] };

  const chunks = await prisma.codeChunk.findMany({
    where: {
      projectId,
      OR: terms.map((t) => ({ normalizedText: { contains: t, mode: "insensitive" as const } })),
    },
    select: { symbol: true, fileId: true, startLine: true, normalizedText: true },
    take: limit,
  });

  const files = await prisma.file.findMany({
    where: { projectId },
    select: { id: true, relPath: true },
  });
  const relById = new Map(files.map((f) => [f.id, f.relPath]));

  const snippets = chunks.map((c) => ({
    ref: c.symbol ?? "",
    at: `${relById.get(c.fileId) ?? "?"}:${c.startLine}`,
    text: (c.normalizedText ?? "").slice(0, 200),
  }));
  const citations: Citation[] = chunks.map((c) => ({
    label: (c.symbol ?? "").split("#").pop() ?? c.symbol ?? "",
    ref: relById.get(c.fileId) ?? "",
    kind: "file",
  }));

  return { snippets, citations };
}
