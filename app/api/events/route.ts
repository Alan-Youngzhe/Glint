import { NextResponse } from "next/server";
import { prisma, ensureDefaultUser } from "@/lib/db";
import type { InteractionEvent } from "@/types/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 批量上报交互事件 → interaction_events（成长分析信号）。 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      projectId: string;
      events: InteractionEvent[];
    };
    if (!body.events?.length) return NextResponse.json({ ok: true, count: 0 });
    const userId = await ensureDefaultUser();
    await prisma.interactionEvent.createMany({
      data: body.events.map((e) => ({
        userId,
        projectId: body.projectId,
        action: e.action,
        focusType: e.focusType,
        focusRef: e.focusRef,
        level: e.level,
        dwellMs: e.dwellMs,
      })),
    });
    return NextResponse.json({ ok: true, count: body.events.length });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
