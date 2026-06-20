/**
 * data-access 层（施工手册 §10）。
 * 前端全程只 import `api`，不直接 fetch。mock 与 real 实现同一接口，
 * 集成时按 NEXT_PUBLIC_API_MODE 切换（或逐方法在 real 内回退到 mock）。
 */
import type {
  ArchitecturePayload,
  CardPayload,
  FileContent,
  InteractionEvent,
  TechItem,
  TechLiteracy,
  TreeNode,
  UnderstandRequest,
  UnderstandResponse,
  UnderstandStreamChunk,
} from "@/types/contract";

export interface GlintApi {
  tree(projectId: string): Promise<TreeNode>;
  file(projectId: string, path: string): Promise<FileContent>;
  understand(req: UnderstandRequest): Promise<UnderstandResponse>;
  understandStream?(
    req: UnderstandRequest,
  ): AsyncIterable<UnderstandStreamChunk>;
  architecture(projectId: string): Promise<ArchitecturePayload>;
  techstack(projectId: string): Promise<TechItem[]>;
  tech(slug: string): Promise<TechLiteracy>;
  logEvents(events: InteractionEvent[]): Promise<void>;
}

export type {
  ArchitecturePayload,
  CardPayload,
  FileContent,
  InteractionEvent,
  TechItem,
  TechLiteracy,
  TreeNode,
  UnderstandRequest,
  UnderstandResponse,
  UnderstandStreamChunk,
};

import { mockApi } from "./mock";
import { realApi } from "./real";

export const api: GlintApi =
  process.env.NEXT_PUBLIC_API_MODE === "real" ? realApi : mockApi;
