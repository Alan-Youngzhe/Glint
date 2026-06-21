import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * M1 自测端点：查符号/引用/调用。
 * GET /api/symbols?projectId=...&file=src/util.ts
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId");
  const file = sp.get("file");
  if (!projectId) {
    return NextResponse.json({ error: "缺少 projectId" }, { status: 400 });
  }

  let fileId: string | undefined;
  if (file) {
    const f = await prisma.file.findFirst({
      where: { projectId, relPath: file },
      select: { id: true },
    });
    fileId = f?.id;
  }

  const [symbols, totals, edgesRaw] = await Promise.all([
    prisma.symbol.findMany({
      where: { projectId, ...(fileId ? { fileId } : {}) },
      select: {
        id: true,
        name: true,
        kind: true,
        startLine: true,
        endLine: true,
        qualifiedName: true,
      },
      orderBy: { startLine: "asc" },
    }),
    Promise.all([
      prisma.symbol.count({ where: { projectId } }),
      prisma.symbolRef.count({ where: { projectId } }),
      prisma.callEdge.count({ where: { projectId } }),
    ]),
    prisma.callEdge.findMany({ where: { projectId }, take: 50 }),
  ]);

  // 解析 edge 两端的符号名，便于肉眼检查
  const ids = [
    ...new Set(edgesRaw.flatMap((e) => [e.callerSymbolId, e.calleeSymbolId])),
  ];
  const named = await prisma.symbol.findMany({
    where: { id: { in: ids } },
    select: { id: true, qualifiedName: true, name: true },
  });
  const nameById = new Map(named.map((s) => [s.id, s.qualifiedName ?? s.name]));
  const edges = edgesRaw.map((e) => ({
    caller: nameById.get(e.callerSymbolId),
    callee: nameById.get(e.calleeSymbolId),
    refCount: e.refCount,
  }));

  return NextResponse.json({
    counts: { symbols: totals[0], refs: totals[1], edges: totals[2] },
    symbols,
    edges,
  });
}
