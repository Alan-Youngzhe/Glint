/**
 * real 实现：fetch /api/*（施工手册 §10）。
 * 后端某接口就绪即在此把该方法接上；尚未实现的暂时复用 mock，保证前端不阻塞。
 */
import type { GlintApi } from "@/lib/api";
import type {
  ArchitecturePayload,
  FileContent,
  InteractionEvent,
  TreeNode,
  UnderstandRequest,
  UnderstandResponse,
} from "@/types/contract";

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
  tree(projectId) {
    return getJson<TreeNode>(`/api/projects/${projectId}/tree`);
  },
  file(projectId, path) {
    return getJson<FileContent>(
      `/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`,
    );
  },
  understand(req: UnderstandRequest) {
    return postJson<UnderstandResponse>("/api/understand", req);
  },
  architecture(projectId) {
    return getJson<ArchitecturePayload>(
      `/api/projects/${projectId}/architecture`,
    );
  },
  async logEvents(events: InteractionEvent[]) {
    await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events }),
    });
  },
};
