/**
 * real 实现：fetch /api/*（施工手册 §10）。
 * 翻新顺序 tree → file → architecture → techstack…：已接通的走真实 fetch，
 * 未接通的暂回退到 mock，保证前端不阻塞、组件无需改动。
 */
import type { GlintApi } from "@/lib/api";
import type {
  ArchitecturePayload,
  FileContent,
  TechItem,
  TechLiteracy,
  TreeNode,
} from "@/types/contract";
import { mockApi } from "@/lib/api/mock";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
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

  // ── 未接通：回退 mock（understand=M3）──
  understand: mockApi.understand,
  understandStream: mockApi.understandStream,
  logEvents: mockApi.logEvents,
};
