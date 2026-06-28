import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { STORAGE_ROOT } from "@/lib/import";
import { runTaskSafe } from "@/lib/ai";
import { writeQueryLog } from "./log";
import type {
  CardPayload,
  CodeExplanation,
  UnderstandRequest,
  UnderstandStreamChunk,
} from "@/types/contract";

/** 取选中代码文本（按 focus.selection 行范围）。 */
async function sliceSelection(req: UnderstandRequest): Promise<{
  lang: string;
  code: string;
  range: string;
}> {
  const { projectId, focus } = req;
  const file = await prisma.file.findFirst({
    where: { projectId, relPath: focus.ref },
    select: { lang: true },
  });
  let code = "";
  try {
    const full = await readFile(path.join(STORAGE_ROOT, projectId, focus.ref), "utf8");
    const lines = full.split("\n");
    const s = focus.selection;
    if (s) code = lines.slice(s.startLine - 1, s.endLine).join("\n");
    else code = full.slice(0, 800);
  } catch {
    /* ignore */
  }
  const range = focus.selection
    ? `lines ${focus.selection.startLine}-${focus.selection.endLine}`
    : "whole file";
  return { lang: file?.lang ?? "text", code, range };
}

/** 构造选中代码卡片：有 key 调 AI 补三段，无 key 降级确定性。 */
async function buildSelectionCard(req: UnderstandRequest): Promise<CardPayload> {
  const { lang, code, range } = await sliceSelection(req);

  const explanation: CodeExplanation = {
    language: lang,
    positionInContext: `Selected ${range}`,
    role: "(realtime explanation needs a model key)",
  };

  const text = await runTaskSafe("explain", [
    {
      role: "system",
      content:
        'Explain code to a non-technical reader. Output JSON only: {"role":"what this does (one sentence)","positionInContext":"where it sits in context","syntax":["syntax points used"]}. In English.',
    },
    { role: "user", content: `Language: ${lang}\nCode:\n${code}` },
  ]);
  if (text) {
    try {
      const j = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
      if (j.role) explanation.role = j.role;
      if (j.positionInContext) explanation.positionInContext = j.positionInContext;
      if (Array.isArray(j.syntax)) explanation.syntax = j.syntax;
    } catch {
      /* 降级 */
    }
  }

  return {
    kind: "card",
    focus: req.focus,
    title: `Selected ${range}`,
    source: "realtime",
    canPin: true,
    explanation,
  };
}

/** ⌥1 选中代码流式（SSE）。先把 role 文本逐字吐出做 UX，再吐 done。 */
export async function* understandStream(
  req: UnderstandRequest,
): AsyncIterable<UnderstandStreamChunk> {
  const card = await buildSelectionCard(req);
  const text = card.explanation?.role ?? "";
  for (const ch of text) {
    await new Promise((r) => setTimeout(r, 8));
    yield { delta: ch };
  }
  writeQueryLog(req.projectId, req.focus, card);
  yield { done: card };
}
