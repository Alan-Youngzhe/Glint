import { NextRequest, NextResponse } from "next/server";
import { weakPoints } from "@/lib/insights/weak";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "缺少 projectId" }, { status: 400 });
  return NextResponse.json(await weakPoints(projectId));
}
