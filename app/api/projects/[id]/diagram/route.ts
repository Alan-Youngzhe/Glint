import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateDiagramGraph } from "@/lib/structure/generate";
import type { DiagramGraph } from "@/lib/structure/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIAGRAM_REF = "__arch_diagram__";

/**
 * ⌥4 LLM 结构化架构图（WP-B2）。命中 dimension_cache 直返；否则生成并缓存。
 * 无 LLM key → generateDiagramGraph 返回 null → { graph: null, source: "deterministic" }，
 * 前端据此降级到确定性图（from-modules）。?refresh=1 强制重新生成。
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const refresh = req.nextUrl.searchParams.get("refresh");

  try {
    if (!refresh) {
      const cached = await prisma.dimensionCache.findFirst({
        where: { projectId: id, focusRef: DIAGRAM_REF, dimension: 4 },
        orderBy: { createdAt: "desc" },
      });
      if (cached) {
        return NextResponse.json({ graph: cached.payload as unknown as DiagramGraph, source: "llm", cached: true });
      }
    }

    const graph = await generateDiagramGraph(id);
    if (!graph) {
      return NextResponse.json({ graph: null, source: "deterministic" });
    }

    await prisma.dimensionCache.deleteMany({
      where: { projectId: id, focusRef: DIAGRAM_REF, dimension: 4 },
    });
    await prisma.dimensionCache.create({
      data: {
        projectId: id,
        focusType: "folder",
        focusRef: DIAGRAM_REF,
        dimension: 4,
        payload: graph as object,
        source: "structure_gen",
      },
    });
    return NextResponse.json({ graph, source: "llm", cached: false });
  } catch (e) {
    // 生成失败也降级，不挡 UI
    return NextResponse.json({
      graph: null,
      source: "deterministic",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
