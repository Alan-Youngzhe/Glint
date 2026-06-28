import { prisma, ensureDefaultUser } from "@/lib/db";
import type { CardPayload, Focus } from "@/types/contract";

const LEVEL = {
  selection: "code",
  variable: "code",
  function: "code",
  class: "code",
  file: "code",
  module: "module",
  folder: "module",
} as const;

/** 写 query_logs（DoD §9）。fire-and-forget，失败不影响主流程。概念标签需 LLM，降级跳过。 */
export function writeQueryLog(projectId: string, focus: Focus, card: CardPayload) {
  void (async () => {
    try {
      const userId = await ensureDefaultUser();
      const answer =
        card.summary ??
        card.explanation?.role ??
        (card.variableRefs ? `defined at ${card.variableRefs.definedAt}` : "") ??
        "";
      await prisma.queryLog.create({
        data: {
          projectId,
          userId,
          level: LEVEL[focus.type],
          mode: focus.type === "selection" ? "selection" : "preset",
          snippet: focus.ref.slice(0, 200),
          answer: answer.slice(0, 2000),
          provider: card.source === "realtime" ? "anthropic" : null,
          costUsd: 0,
        },
      });
    } catch {
      /* ignore */
    }
  })();
}
