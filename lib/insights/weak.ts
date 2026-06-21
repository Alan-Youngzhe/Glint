import { prisma } from "@/lib/db";
import type { WeakPoint } from "@/types/contract";

const ASK_ACTIONS = new Set(["dim1", "dim2", "dim3", "dim4", "drill"]);

/**
 * 弱项分析（V4 §6）：聚合 interaction_events（反复 Option/钻取同一对象 = 弱项信号）。
 * 概念标签（query_concept_tags）需 LLM 打标，未填充时用 focusRef 作代理——交互轨迹驱动结论。
 */
export async function weakPoints(projectId: string): Promise<WeakPoint[]> {
  const events = await prisma.interactionEvent.findMany({
    where: { projectId },
    select: { focusRef: true, action: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<string, { times: number[] }>();
  const t0 = events.length ? events[0].createdAt.getTime() : 0;
  const t1 = events.length ? events[events.length - 1].createdAt.getTime() : 1;
  const mid = (t0 + t1) / 2;

  for (const e of events) {
    if (!ASK_ACTIONS.has(e.action)) continue;
    const g = groups.get(e.focusRef) ?? { times: [] };
    g.times.push(e.createdAt.getTime());
    groups.set(e.focusRef, g);
  }

  const out: WeakPoint[] = [];
  for (const [ref, g] of groups) {
    const askCount = g.times.length;
    if (askCount < 2) continue; // 只看反复探索的
    const early = g.times.filter((t) => t <= mid).length;
    const late = g.times.length - early;
    const trend: WeakPoint["trend"] = late > early ? "up" : late < early ? "down" : "flat";
    out.push({
      slug: ref,
      name: ref.split("/").pop()?.split("#").pop() ?? ref,
      askCount,
      trend,
      mastery: Math.max(0, Math.min(1, 1 - askCount / 8)),
    });
  }

  return out.sort((a, b) => b.askCount - a.askCount).slice(0, 20);
}
