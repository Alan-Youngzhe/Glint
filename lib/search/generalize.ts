import { prisma } from "@/lib/db";
import type { Focus, GeneralizeResult, SimilarHit } from "@/types/contract";

/**
 * 泛化检索（V4 §4）：结构路——按 astFingerprint 找相同结构的写法（确定性，变量名无关）。
 * 语义路（pgvector 近邻）待嵌入就绪（需 embedding key）后双召回合并。
 */
export async function generalize(
  projectId: string,
  focus: Focus,
): Promise<GeneralizeResult> {
  // 解析焦点 → qualifiedName（与 code_chunks.symbol 同格式 relPath#name）
  let qn: string | null = null;
  if (focus.type === "function" || focus.type === "class") {
    const sym = await prisma.symbol.findUnique({
      where: { id: focus.ref },
      select: { qualifiedName: true },
    });
    qn = sym?.qualifiedName ?? null;
  }
  if (!qn) return { focus, hits: [] };

  const self = await prisma.codeChunk.findFirst({
    where: { projectId, symbol: qn },
    select: { astFingerprint: true },
  });
  if (!self?.astFingerprint) return { focus, hits: [] };

  const peers = await prisma.codeChunk.findMany({
    where: {
      projectId,
      astFingerprint: self.astFingerprint,
      NOT: { symbol: qn },
    },
    select: { symbol: true, fileId: true, startLine: true },
    take: 20,
  });

  const files = await prisma.file.findMany({
    where: { projectId },
    select: { id: true, relPath: true },
  });
  const relById = new Map(files.map((f) => [f.id, f.relPath]));

  const hits: SimilarHit[] = peers.map((p) => ({
    ref: p.symbol ?? "",
    at: `${relById.get(p.fileId) ?? "?"}:${p.startLine}`,
    similarity: 1,
    note: "结构相同",
  }));

  return { focus, hits };
}
