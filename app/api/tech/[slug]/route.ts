import { NextResponse } from "next/server";
import { getTechLiteracy } from "@/lib/techstack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  return NextResponse.json(await getTechLiteracy(slug));
}
