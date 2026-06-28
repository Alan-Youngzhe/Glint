import type { TechItem, TechLiteracy } from "@/types/contract";

/** 技术栈项（mock）。real 时由 TechStackItem 表来。 */
export const techstackFixture: TechItem[] = [
  {
    slug: "typescript",
    name: "TypeScript",
    kind: "language",
    version: "5.x",
    role: "全栈语言，端到端类型安全",
    usageRefs: [{ at: "auth/guard.ts" }, { at: "api/user.ts" }],
  },
  {
    slug: "nextjs",
    name: "Next.js",
    kind: "framework",
    version: "15.x",
    role: "App Router 全栈框架，承载前端与 Route Handlers",
    usageRefs: [{ at: "app/page.tsx" }],
  },
  {
    slug: "node",
    name: "Node.js",
    kind: "tool",
    role: "运行时",
  },
];

/** 通用认知（mock）。real 时命中/写回 TechLiteracy 全局表。 */
export const techLiteracyFixture: Record<string, TechLiteracy> = {
  typescript: {
    slug: "typescript",
    name: "TypeScript",
    what: "JavaScript 的超集，加了静态类型系统。",
    purpose: "在编译期发现类型错误，提升大型项目可维护性。",
    ecosystemPosition: "前端/Node 后端的事实标准语言之一。",
  },
  nextjs: {
    slug: "nextjs",
    name: "Next.js",
    what: "基于 React 的全栈框架。",
    purpose: "统一前端渲染与后端 API，简化部署。",
    ecosystemPosition: "React 生态最主流的应用框架。",
  },
  node: {
    slug: "node",
    name: "Node.js",
    what: "基于 V8 的 JavaScript 运行时。",
    purpose: "在服务端运行 JS，承载 Web 服务与工具链。",
    ecosystemPosition: "服务端 JS 的基础运行时。",
  },
};
