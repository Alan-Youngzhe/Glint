import type { ArchitecturePayload } from "@/types/contract";

/** ⌥4 架构 Treemap + 概述（mock，直读）。 */
export const architectureFixture: ArchitecturePayload = {
  kind: "architecture",
  focus: { type: "folder", ref: "" },
  techStack: ["TypeScript", "Next.js", "Node"],
  overview: {
    summary:
      "一个最小的服务端示例：auth 负责会话与守卫，api 暴露受保护的业务端点，index 汇总路由。",
    entryPoints: ["index.ts"],
    readingGuide: [
      "先看 index.ts 了解暴露了哪些路由",
      "再看 auth/guard.ts 理解统一的登录守卫",
      "最后看 api/*.ts 各业务端点如何复用守卫",
    ],
  },
  root: {
    id: "root",
    name: "demo-app",
    kind: "dir",
    loc: 60,
    children: [
      {
        id: "auth",
        name: "auth",
        kind: "module",
        loc: 26,
        children: [
          { id: "auth/guard.ts", name: "guard.ts", kind: "file", loc: 11 },
          { id: "auth/session.ts", name: "session.ts", kind: "file", loc: 15 },
        ],
      },
      {
        id: "api",
        name: "api",
        kind: "module",
        loc: 24,
        children: [
          { id: "api/user.ts", name: "user.ts", kind: "file", loc: 12 },
          { id: "api/order.ts", name: "order.ts", kind: "file", loc: 12 },
        ],
      },
      { id: "index.ts", name: "index.ts", kind: "file", loc: 10 },
    ],
  },
};
