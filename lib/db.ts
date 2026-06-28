import { PrismaClient } from "@prisma/client";

/** Prisma 单例（dev 热重载下复用，避免连接爆炸）。 */
const g = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = g.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") g.prisma = prisma;

/** MVP 单用户：保证存在一个默认 user，返回其 id。 */
export async function ensureDefaultUser(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: "local@glint.dev" },
    update: {},
    create: { email: "local@glint.dev", name: "Local" },
  });
  return user.id;
}
