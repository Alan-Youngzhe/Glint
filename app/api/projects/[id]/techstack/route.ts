import { NextResponse } from "next/server";
import { getTechStack } from "@/lib/techstack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return NextResponse.json(await getTechStack(id));
}
