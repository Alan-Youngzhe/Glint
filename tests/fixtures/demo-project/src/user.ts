import { requireUser } from "./auth";

// getProfile 调 requireUser（跨文件调用边，验证 ⌥2/⌥3）
export function getProfile(token: string | null) {
  const user = requireUser(token);
  return { id: user.userId };
}
