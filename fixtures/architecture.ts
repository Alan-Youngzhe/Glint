import type { ArchitecturePayload } from "@/types/contract";

/** ⌥4 架构地图 + 概述（mock，直读）。 */
export const architectureFixture: ArchitecturePayload = {
  kind: "architecture",
  focus: { type: "folder", ref: "" },
  techStack: ["TypeScript", "Next.js", "Node"],
  modules: [
    {
      name: "api",
      pathScope: "api",
      role: "interface",
      loc: 24,
      fileCount: 2,
      isEntry: false,
      uses: ["auth"],
      topFile: "api/user.ts",
    },
    {
      name: "auth",
      pathScope: "auth",
      role: "logic",
      loc: 26,
      fileCount: 2,
      isEntry: false,
      uses: [],
      topFile: "auth/session.ts",
    },
    {
      name: "(root)",
      pathScope: "",
      role: "other",
      loc: 10,
      fileCount: 1,
      isEntry: true,
      uses: ["api", "auth"],
      topFile: "index.ts",
    },
  ],
  overview: {
    summary:
      "A minimal server example: auth owns sessions and the login guard, api exposes the protected business endpoints, and index wires the routes together.",
    entryPoints: ["index.ts"],
    readingGuide: [
      "Start from index.ts to see which routes are exposed",
      "Then auth/guard.ts for the shared login guard",
      "Finally api/*.ts for how each endpoint reuses the guard",
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
