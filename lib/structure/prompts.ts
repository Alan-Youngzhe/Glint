import type { LLMMessage } from "@/lib/ai/types";

/**
 * 两遍 prompt（借鉴 gitdiagram src/server/generate/prompts.ts，MIT）。
 * 第一遍：大白话解释架构（禁 JSON/Mermaid）；第二遍：转结构化 DiagramGraph JSON。
 * 校验失败把 feedback 拼进第二遍，强制修到 path 全部命中真实文件。
 */

export interface DiagramPromptContext {
  projectName: string;
  fileTree: string; // 截断后的目录树（每行一个相对路径）
  modules: string; // 模块摘要（name · role · files · loc · uses）
  techStack: string;
  readme?: string;
}

const SYSTEM_FIRST = `
You are a principal software engineer analyzing a repository in order to explain its architecture clearly to a non-technical, product-minded reader.

You will receive a <file_tree>, a <modules> summary, a <tech_stack>, and optionally a <readme>.

Explain the repository so another engineer could draw an accurate architecture diagram.

Requirements:
- Be concrete and repo-specific.
- Identify the main subsystems, the data flow between them, and the important boundaries.
- Mention technologies, runtimes, tooling, or external services only when they materially shape the architecture.
- Keep it concise and high-signal. Prefer 8-16 short paragraphs over a long essay.
- Do not assume the project is a web app — it could be any repo type.
- Avoid Mermaid syntax, JSON, pseudo-code, or implementation instructions.

Return only:
<explanation>
...
</explanation>
`.trim();

const SYSTEM_GRAPH = `
You are a repository-to-graph planner. You turn an architecture explanation into a crisp, high-signal graph a human can grasp quickly. The goal is an opinionated overview, NOT a complete inventory.

You will receive an <explanation>, a <file_tree>, a <modules> summary, optionally a <previous_graph> and <validation_feedback>.

Output ONLY a single JSON object matching this schema (no prose, no Mermaid, no markdown fences):
{
  "groups": [{ "id": "lowercase_snake", "label": "Short Title", "description": string | null }],
  "nodes": [{
    "id": "lowercase_snake",
    "label": "1-4 words",
    "type": string | null,        // short, repo-specific role shown as a secondary line, e.g. "HTTP backend", "DAG executor"
    "groupId": string | null,     // must match a group id above, or null
    "path": string | null,        // an EXACT repo-relative path that appears in <file_tree>, or null
    "shape": "box" | "database" | "circle" | "hexagon" | null,  // rendering hint; use "database" for stores
    "startLine": number | null,
    "endLine": number | null
  }],
  "edges": [{ "from": "node_id", "to": "node_id", "label": "relationship verb", "style": "solid" | "dashed" | null }]
}

Rules:
- Every field above must be present; use null when it does not apply.
- ids must match ^[a-z][a-z0-9_]*$ and be unique.
- "path" must EXACTLY match a path in <file_tree>; never invent paths. Prefer the most representative file of a subsystem.
- Edges must connect existing node ids. Use meaningful relationship verbs as labels ("calls", "renders", "persists via", "loads", "orchestrates"), not "uses" everywhere.
- Use "dashed" style for weak/optional/inferred relationships.
- Keep groups single-level. Favor 0-8 groups, 12-26 nodes, 10-34 edges.
- Collapse repeated internals into one representative node. Skip tests, config, and tiny utilities unless architecturally central.
- When a subsystem is central, break it into 2-4 internal nodes instead of one black box.
- The result should read like an opinionated architecture summary.

If <validation_feedback> is provided, fix EVERY issue while preserving the intended architecture.
`.trim();

function userContext(ctx: DiagramPromptContext): string {
  return [
    `<file_tree>\n${ctx.fileTree}\n</file_tree>`,
    `<modules>\n${ctx.modules}\n</modules>`,
    `<tech_stack>\n${ctx.techStack}\n</tech_stack>`,
    ctx.readme ? `<readme>\n${ctx.readme}\n</readme>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function firstPassMessages(ctx: DiagramPromptContext): LLMMessage[] {
  return [
    { role: "system", content: SYSTEM_FIRST },
    { role: "user", content: `Project: ${ctx.projectName}\n\n${userContext(ctx)}` },
  ];
}

export function graphPassMessages(
  ctx: DiagramPromptContext,
  explanation: string,
  feedback?: string,
  previousGraph?: string,
): LLMMessage[] {
  const parts = [
    `<explanation>\n${explanation}\n</explanation>`,
    `<file_tree>\n${ctx.fileTree}\n</file_tree>`,
    `<modules>\n${ctx.modules}\n</modules>`,
    previousGraph ? `<previous_graph>\n${previousGraph}\n</previous_graph>` : "",
    feedback ? `<validation_feedback>\n${feedback}\n</validation_feedback>` : "",
  ].filter(Boolean);
  return [
    { role: "system", content: SYSTEM_GRAPH },
    { role: "user", content: parts.join("\n\n") },
  ];
}
