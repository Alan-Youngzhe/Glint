export interface Session {
  userId: string;
}

export function getSession(token: string | null): Session | null {
  if (!token) return null;
  return { userId: "u_1" };
}

// requireUser 调 getSession（同文件调用边）
export function requireUser(token: string | null): Session {
  const session = getSession(token);
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
