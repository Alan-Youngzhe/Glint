/**
 * mock 实现：读 fixtures/ 假数据，形状严格等于契约（施工手册 §10）。
 * 集成时把对应方法切到 real，无需改组件。
 */
import type { GlintApi } from "@/lib/api";
import type {
  ArchitecturePayload,
  CardPayload,
  FileContent,
  TechItem,
  TechLiteracy,
  TreeNode,
  UnderstandRequest,
  UnderstandResponse,
} from "@/types/contract";
import { architectureFixture } from "@/fixtures/architecture";
import { fileContents, treeFixture } from "@/fixtures/tree";
import { understandFixture } from "@/fixtures/understand";
import { techLiteracyFixture, techstackFixture } from "@/fixtures/techstack";

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

export const mockApi: GlintApi = {
  async tree(_projectId: string): Promise<TreeNode> {
    await delay();
    return treeFixture;
  },

  async file(_projectId: string, path: string): Promise<FileContent> {
    await delay();
    return (
      fileContents[path] ?? { content: `// ${path}\n// (mock: 无内容)`, lang: "text" }
    );
  },

  async understand(req: UnderstandRequest): Promise<UnderstandResponse> {
    await delay(200);
    return understandFixture(req);
  },

  async *understandStream(req: UnderstandRequest) {
    const res = understandFixture(req);
    if (res.kind !== "card") {
      yield { done: res as unknown as CardPayload };
      return;
    }
    const text = res.summary ?? res.explanation?.role ?? "（mock 解释）";
    for (const ch of text) {
      await delay(12);
      yield { delta: ch };
    }
    yield { done: res };
  },

  async architecture(_projectId: string): Promise<ArchitecturePayload> {
    await delay();
    return architectureFixture;
  },

  async techstack(_projectId: string): Promise<TechItem[]> {
    await delay();
    return techstackFixture;
  },

  async tech(slug: string): Promise<TechLiteracy> {
    await delay();
    const t = techLiteracyFixture[slug];
    if (!t) {
      return {
        slug,
        name: slug,
        what: "（mock：暂无认知）",
        purpose: "",
        ecosystemPosition: "",
      };
    }
    return t;
  },

  async *agent(req) {
    const reply = `（mock Agent）已收到："${req.message}"。真实编排在三期接通。`;
    for (const ch of reply) {
      await delay(10);
      yield { type: "token" as const, delta: ch };
    }
    yield {
      type: "suggestion" as const,
      suggestions: [{ text: "看看项目架构", action: { kind: "open_panel", panel: "arch" } }],
    };
    yield { type: "done" as const, messageId: "mock" };
  },

  async logEvents(events): Promise<void> {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("[mock] logEvents", events.length);
    }
  },
};
