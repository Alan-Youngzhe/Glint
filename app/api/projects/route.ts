import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { importZip } from "@/lib/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 上传项目：multipart，字段 `file`=zip，可选 `name`。 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "缺少 file（zip）" }, { status: 400 });
    }
    const name =
      (form.get("name") as string | null) ??
      file.name.replace(/\.zip$/i, "") ??
      "untitled";
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await importZip(buf, name);
    return NextResponse.json({
      project: { id: result.projectId, name },
      jobId: result.jobId,
      fileCount: result.fileCount,
      skipped: result.skipped,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/** 项目列表。 */
export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true, createdAt: true },
  });
  return NextResponse.json(projects);
}
