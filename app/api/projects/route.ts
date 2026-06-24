import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { importZip } from "@/lib/import";
import { parseProject } from "@/lib/parse";
import { detectTechStack } from "@/lib/techstack";
import { pregenProject } from "@/lib/pregen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 上传项目：multipart，字段 `file`=zip，可选 `name`。 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file (zip)" }, { status: 400 });
    }
    const name =
      (form.get("name") as string | null) ??
      file.name.replace(/\.zip$/i, "") ??
      "untitled";
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await importZip(buf, name);

    // 符号/引用/调用解析（tree-sitter，确定性）
    let parsed: { symbols: number; refs: number; edges: number } | null = null;
    try {
      parsed = await parseProject(result.projectId);
      await prisma.job.create({
        data: {
          projectId: result.projectId,
          type: "symbol",
          status: "done",
          progress: parsed,
        },
      });
    } catch (e) {
      console.error("[parseProject] failed:", e);
      await prisma.job.create({
        data: {
          projectId: result.projectId,
          type: "symbol",
          status: "error",
          error: e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e),
        },
      });
    }

    // 技术栈检测（确定性）
    let tech = 0;
    try {
      tech = await detectTechStack(result.projectId);
    } catch (e) {
      console.error("[detectTechStack] failed:", e);
    }

    // 预理解：结构 + 模块关系 + 架构（确定性骨架 + LLM 可选）
    let pregen: { structureNodes: number; modules: number } | null = null;
    try {
      pregen = await pregenProject(result.projectId);
      await prisma.job.create({
        data: { projectId: result.projectId, type: "pregen", status: "done", progress: pregen },
      });
    } catch (e) {
      console.error("[pregenProject] failed:", e);
      await prisma.job.create({
        data: {
          projectId: result.projectId,
          type: "pregen",
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        },
      });
    }

    return NextResponse.json({
      project: { id: result.projectId, name },
      jobId: result.jobId,
      fileCount: result.fileCount,
      skipped: result.skipped,
      parsed,
      tech,
      pregen,
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
