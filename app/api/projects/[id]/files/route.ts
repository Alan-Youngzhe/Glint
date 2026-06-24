import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { STORAGE_ROOT } from "@/lib/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const rel = req.nextUrl.searchParams.get("path");
  if (!rel) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const baseDir = path.join(STORAGE_ROOT, id);
  const abs = path.join(baseDir, rel);
  // 防目录穿越
  if (!abs.startsWith(baseDir + path.sep)) {
    return NextResponse.json({ error: "Illegal path" }, { status: 400 });
  }

  const record = await prisma.file.findFirst({
    where: { projectId: id, relPath: rel },
    select: { lang: true },
  });

  try {
    const content = await readFile(abs, "utf8");
    return NextResponse.json({ content, lang: record?.lang ?? "text" });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
