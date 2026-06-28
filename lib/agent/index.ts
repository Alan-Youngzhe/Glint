import { prisma, ensureDefaultUser } from "@/lib/db";
import { runTaskSafe } from "@/lib/ai";
import { retrieve } from "@/lib/rag";
import type { AgentEvent, Citation, Suggestion } from "@/types/contract";

/**
 * Agent 编排（V3 §7）。MVP：单轮 + 确定性上下文（结构/模块/技术栈）。
 * 有 key → LLM 综合答；无 key → 确定性概览降级。工具调用循环留四期深化（强化 retrieve）。
 */
export async function* agentLoop(
  projectId: string,
  message: string,
  sessionId?: string,
): AsyncIterable<AgentEvent> {
  const [analysis, modules, tech] = await Promise.all([
    prisma.projectAnalysis.findFirst({ where: { projectId }, orderBy: { createdAt: "desc" } }),
    prisma.module.findMany({ where: { projectId }, select: { name: true, responsibility: true, dependsOn: true } }),
    prisma.techStackItem.findMany({ where: { projectId }, select: { name: true, kind: true } }),
  ]);

  // RAG：按问题跨文件检索相关代码（V4 §5）
  const rag = await retrieve(projectId, message);
  const ragCtx = rag.snippets.length
    ? `\nRelevant code:\n${rag.snippets.map((s) => `- ${s.at} ${s.ref}`).join("\n")}`
    : "";

  const ctx =
    `Architecture: ${analysis?.architectureOverview ?? "(none)"}.\n` +
    `Modules: ${modules.map((m) => m.name).join(", ") || "(none)"}.\n` +
    `Tech stack: ${tech.map((t) => t.name).join(", ") || "(none)"}.${ragCtx}`;

  const llm = await runTaskSafe("explain", [
    {
      role: "system",
      content: "You are a codebase explainer agent for non-technical readers. Answer concisely in English, using only the given context.",
    },
    { role: "user", content: `${ctx}\n\nUser question: ${message}` },
  ]);

  const answer =
    llm ??
    `(No model key — deterministic overview)\n${ctx}\n\nSet ANTHROPIC_API_KEY and I can answer "${message}" in depth.`;

  for (const ch of answer) {
    await new Promise((r) => setTimeout(r, 6));
    yield { type: "token", delta: ch };
  }

  // 引用：检索命中的文件（RAG）+ 模块
  const citations: Citation[] = [
    ...rag.citations.slice(0, 4),
    ...modules.slice(0, 2).map((m) => ({ label: m.name, ref: m.name, kind: "node" as const })),
  ];
  for (const c of citations) yield { type: "citation", citation: c };

  // 建议（每条带 action，驱动界面）
  const suggestions: Suggestion[] = [
    { text: "See the project architecture", action: { kind: "open_panel", panel: "arch" } },
  ];
  if (modules[0]) {
    suggestions.push({
      text: `Dive into the ${modules[0].name} module`,
      action: { kind: "trigger_dimension", focus: { type: "module", ref: modules[0].name }, dimension: 1 },
    });
  }
  yield { type: "suggestion", suggestions };

  // 落库（agent_sessions / agent_messages）
  let sid = sessionId;
  try {
    const userId = await ensureDefaultUser();
    if (!sid) {
      const s = await prisma.agentSession.create({
        data: { userId, projectId, title: message.slice(0, 40) },
      });
      sid = s.id;
    }
    await prisma.agentMessage.create({ data: { sessionId: sid, role: "user", content: message } });
    const msg = await prisma.agentMessage.create({
      data: {
        sessionId: sid,
        role: "assistant",
        content: answer,
        citations: citations as unknown as object,
        suggestions: suggestions as unknown as object,
      },
    });
    yield { type: "done", messageId: msg.id };
  } catch {
    yield { type: "done", messageId: "unsaved" };
  }
}
