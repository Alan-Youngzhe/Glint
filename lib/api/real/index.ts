/**
 * real 实现：fetch /api/*（施工手册 §10）。
 * 翻新顺序 tree → file → architecture → techstack…：已接通的走真实 fetch，
 * 未接通的暂回退到 mock，保证前端不阻塞、组件无需改动。
 */
import type { GlintApi } from "@/lib/api";
import type {
  AgentEvent,
  AgentRequest,
  ArchitecturePayload,
  FileContent,
  TechItem,
  TechLiteracy,
  TreeNode,
  UnderstandRequest,
  UnderstandResponse,
  UnderstandStreamChunk,
} from "@/types/contract";
import { mockApi } from "@/lib/api/mock";

/** 通用 SSE 解析（data: {json}）。 */
async function* sse<T>(url: string, body: unknown): AsyncIterable<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const p of parts) {
      const line = p.trim();
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (json) yield JSON.parse(json) as T;
    }
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json() as Promise<T>;
}


export const realApi: GlintApi = {
  // ── 已接通（M1）──
  tree(projectId) {
    return getJson<TreeNode>(`/api/projects/${projectId}/tree`);
  },
  file(projectId, path) {
    return getJson<FileContent>(
      `/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`,
    );
  },

  // ── 已接通（M2）──
  techstack(projectId) {
    return getJson<TechItem[]>(`/api/projects/${projectId}/techstack`);
  },
  tech(slug) {
    return getJson<TechLiteracy>(`/api/tech/${encodeURIComponent(slug)}`);
  },
  architecture(projectId) {
    return getJson<ArchitecturePayload>(`/api/projects/${projectId}/architecture`);
  },

  // ── 已接通（M3）──
  understand(req: UnderstandRequest) {
    return postJson<UnderstandResponse>("/api/understand", req);
  },
  understandStream(req: UnderstandRequest) {
    return sse<UnderstandStreamChunk>("/api/understand", req);
  },
  agent(req: AgentRequest) {
    return sse<AgentEvent>("/api/agent", req);
  },

  // ── logEvents 经 reportEvent 直发 /api/events（带 projectId）──
  logEvents: mockApi.logEvents,
};
