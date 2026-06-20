import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { STORAGE_ROOT } from "@/lib/import";
import { runTaskSafe } from "@/lib/ai";
import type { TechItem, TechLiteracy } from "@/types/contract";

type Kind = TechItem["kind"];

/** 编程语言显示名（只把这些算作 language 技术项）。 */
const LANG_NAME: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  go: "Go",
  rust: "Rust",
  java: "Java",
  ruby: "Ruby",
  c: "C",
  cpp: "C++",
};

/** package.json 依赖分类（命中即用，否则 library）。 */
const KIND_MAP: Record<string, Kind> = {
  next: "framework",
  react: "framework",
  "react-dom": "framework",
  vue: "framework",
  nuxt: "framework",
  svelte: "framework",
  "@angular/core": "framework",
  express: "framework",
  koa: "framework",
  fastify: "framework",
  "@nestjs/core": "framework",
  typescript: "tool",
  eslint: "tool",
  prettier: "tool",
  jest: "tool",
  vitest: "tool",
  webpack: "tool",
  vite: "tool",
  tailwindcss: "tool",
  postcss: "tool",
  turbo: "tool",
  tsx: "tool",
  "ts-node": "tool",
  prisma: "tool",
  pg: "datastore",
  mysql: "datastore",
  mongodb: "datastore",
  redis: "datastore",
  sqlite3: "datastore",
};

/** 确定性检测技术栈 → 写 TechStackItem（可重入）。 */
export async function detectTechStack(projectId: string): Promise<number> {
  const files = await prisma.file.findMany({
    where: { projectId },
    select: { relPath: true, lang: true },
  });

  interface DetectedItem {
    kind: Kind;
    name: string;
    slug: string;
    version?: string;
    role?: string;
    detectedFrom: string[];
    usageRefs: { at: string }[];
  }
  const items: DetectedItem[] = [];

  // 语言（按扩展名）
  const byLang = new Map<string, string[]>();
  for (const f of files) {
    if (LANG_NAME[f.lang ?? ""]) {
      const arr = byLang.get(f.lang!) ?? [];
      if (arr.length < 5) arr.push(f.relPath);
      byLang.set(f.lang!, arr);
    }
  }
  for (const [lang, refs] of byLang) {
    items.push({
      kind: "language",
      name: LANG_NAME[lang],
      slug: lang,
      role: `${files.filter((f) => f.lang === lang).length} 个文件`,
      detectedFrom: ["扩展名"],
      usageRefs: refs.map((at) => ({ at })),
    });
  }

  // package.json 依赖
  const pkgFile = files.find((f) => f.relPath === "package.json");
  if (pkgFile) {
    try {
      const raw = await readFile(
        path.join(STORAGE_ROOT, projectId, "package.json"),
        "utf8",
      );
      const pkg = JSON.parse(raw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      for (const [name, version] of Object.entries(deps)) {
        items.push({
          kind: KIND_MAP[name] ?? "library",
          name,
          slug: name.toLowerCase(),
          version: typeof version === "string" ? version : undefined,
          detectedFrom: ["package.json"],
          usageRefs: [],
        });
      }
    } catch {
      /* package.json 解析失败忽略 */
    }
  }

  await prisma.techStackItem.deleteMany({ where: { projectId } });
  if (items.length) {
    await prisma.techStackItem.createMany({
      data: items.map((it) => ({
        projectId,
        kind: it.kind,
        name: it.name,
        slug: it.slug,
        version: it.version,
        role: it.role,
        detectedFrom: it.detectedFrom,
        usageRefs: it.usageRefs,
      })),
    });
  }
  return items.length;
}

/** 取技术栈列表（确定性，直读）。 */
export async function getTechStack(projectId: string): Promise<TechItem[]> {
  const rows = await prisma.techStackItem.findMany({
    where: { projectId },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    kind: r.kind,
    version: r.version ?? undefined,
    role: r.role ?? undefined,
    usageRefs: (r.usageRefs as { at: string }[] | null) ?? undefined,
  }));
}

/** 通用认知卡片：命中 TechLiteracy 直读；未命中 LLM 生成并缓存（无 key 降级、不缓存）。 */
export async function getTechLiteracy(slug: string): Promise<TechLiteracy> {
  const cached = await prisma.techLiteracy.findUnique({ where: { slug } });
  if (cached) {
    return {
      slug: cached.slug,
      name: cached.name,
      what: cached.what,
      purpose: cached.purpose,
      ecosystemPosition: cached.ecosystemPosition,
    };
  }

  const text = await runTaskSafe("generalize_note", [
    {
      role: "system",
      content:
        "你是技术百科。只输出 JSON：{\"what\":\"是什么\",\"purpose\":\"用途\",\"ecosystemPosition\":\"生态位置\"}，每项一句话中文。",
    },
    { role: "user", content: `技术：${slug}` },
  ]);

  let parsed: { what?: string; purpose?: string; ecosystemPosition?: string } = {};
  if (text) {
    try {
      parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
    } catch {
      /* 解析失败按降级处理 */
    }
  }

  const literacy: TechLiteracy = {
    slug,
    name: slug,
    what: parsed.what ?? "（待生成：配置模型 Key 后自动补全）",
    purpose: parsed.purpose ?? "",
    ecosystemPosition: parsed.ecosystemPosition ?? "",
  };

  // 只缓存真实生成的结果（降级占位不写库，便于日后补全）
  if (parsed.what) {
    await prisma.techLiteracy.create({
      data: {
        slug,
        kind: "unknown",
        name: literacy.name,
        what: literacy.what,
        purpose: literacy.purpose,
        ecosystemPosition: literacy.ecosystemPosition,
      },
    });
  }

  return literacy;
}
