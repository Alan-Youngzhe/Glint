import { NextResponse } from "next/server";
import { generalize } from "@/lib/search/generalize";
import type { Focus } from "@/types/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { projectId: string; focus: Focus };
  return NextResponse.json(await generalize(body.projectId, body.focus));
}
