import type { FileContent, TreeNode } from "@/types/contract";

/** 示例项目的文件树（mock）。 */
export const treeFixture: TreeNode = {
  id: "root",
  name: "demo-app",
  path: "",
  kind: "dir",
  children: [
    {
      id: "auth",
      name: "auth",
      path: "auth",
      kind: "dir",
      children: [
        { id: "auth/guard.ts", name: "guard.ts", path: "auth/guard.ts", kind: "file" },
        { id: "auth/session.ts", name: "session.ts", path: "auth/session.ts", kind: "file" },
      ],
    },
    {
      id: "api",
      name: "api",
      path: "api",
      kind: "dir",
      children: [
        { id: "api/user.ts", name: "user.ts", path: "api/user.ts", kind: "file" },
        { id: "api/order.ts", name: "order.ts", path: "api/order.ts", kind: "file" },
      ],
    },
    { id: "index.ts", name: "index.ts", path: "index.ts", kind: "file" },
  ],
};

export const fileContents: Record<string, FileContent> = {
  "auth/guard.ts": {
    lang: "typescript",
    content: `import { getSession } from "./session";

export async function requireUser(req: Request) {
  const session = await getSession(req);
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user;
}
`,
  },
  "auth/session.ts": {
    lang: "typescript",
    content: `export interface Session {
  user: { id: string; name: string };
}

export async function getSession(req: Request): Promise<Session | null> {
  const token = req.headers.get("authorization");
  if (!token) return null;
  return { user: { id: "u_1", name: "Alan" } };
}
`,
  },
  "api/user.ts": {
    lang: "typescript",
    content: `import { requireUser } from "../auth/guard";

export async function getProfile(req: Request) {
  const user = await requireUser(req);
  return { id: user.id, name: user.name };
}
`,
  },
  "api/order.ts": {
    lang: "typescript",
    content: `import { requireUser } from "../auth/guard";

export async function listOrders(req: Request) {
  const user = await requireUser(req);
  return [{ id: "o_1", userId: user.id }];
}
`,
  },
  "index.ts": {
    lang: "typescript",
    content: `import { getProfile } from "./api/user";
import { listOrders } from "./api/order";

export const routes = { getProfile, listOrders };
`,
  },
};
