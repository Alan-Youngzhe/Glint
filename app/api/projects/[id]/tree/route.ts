import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildTree } from "@/lib/import/tree";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const files = await prisma.file.findMany({
    where: { projectId: id },
    select: { relPath: true },
  });
  if (!files.length) {
    const exists = await prisma.project.findUnique({ where: { id } });
    if (!exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
  }
  const tree = buildTree(files.map((f) => f.relPath));
  return NextResponse.json(tree);
}
