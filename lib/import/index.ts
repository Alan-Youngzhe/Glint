import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { ensureDefaultUser, prisma } from "@/lib/db";

/** 上传项目的本地文件存储根。 */
export const STORAGE_ROOT = path.join(process.cwd(), ".glint-storage");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  "vendor",
  "coverage",
  ".turbo",
  ".cache",
]);

const SKIP_FILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  ".DS_Store",
]);

const MAX_BYTES = 512 * 1024;

const LANG_BY_EXT: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  go: "go",
  rs: "rust",
  java: "java",
  rb: "ruby",
  c: "c",
  h: "c",
  cc: "cpp",
  cpp: "cpp",
  json: "json",
  md: "markdown",
  css: "css",
  scss: "css",
  html: "html",
  yml: "yaml",
  yaml: "yaml",
  sh: "shell",
};

function langOf(rel: string): string {
  const ext = rel.split(".").pop()?.toLowerCase() ?? "";
  return LANG_BY_EXT[ext] ?? "text";
}

function shouldSkip(rel: string): boolean {
  const segs = rel.split("/");
  if (segs.some((s) => SKIP_DIRS.has(s))) return true;
  const base = segs[segs.length - 1];
  if (SKIP_FILES.has(base)) return true;
  if (/\.(min\.(js|css)|map)$/i.test(base)) return true;
  return false;
}

function isBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

/** 统一相对路径：去掉 zip 里可能存在的单一顶层目录前缀。 */
function stripTopDir(names: string[]): (rel: string) => string {
  const tops = new Set(
    names.map((n) => n.split("/")[0]).filter((s) => s.length > 0),
  );
  if (tops.size !== 1) return (r) => r;
  const top = [...tops][0];
  return (r) => (r.startsWith(top + "/") ? r.slice(top.length + 1) : r);
}

export interface ImportResult {
  projectId: string;
  jobId: string;
  fileCount: number;
  skipped: number;
}

/** 解压 zip → 过滤 → files 入库 + 落盘。M1 同步执行（小项目）。 */
export async function importZip(
  zipBuf: Buffer,
  projectName: string,
): Promise<ImportResult> {
  const userId = await ensureDefaultUser();
  const project = await prisma.project.create({
    data: { userId, name: projectName, sourceType: "local", status: "indexing" },
  });
  const storageDir = path.join(STORAGE_ROOT, project.id);

  const zip = await JSZip.loadAsync(zipBuf);
  const entries = Object.values(zip.files).filter((e) => !e.dir);
  const strip = stripTopDir(entries.map((e) => e.name));

  const records: {
    projectId: string;
    relPath: string;
    lang: string;
    sizeBytes: number;
    loc: number;
    contentHash: string;
    isBinary: boolean;
  }[] = [];
  let skipped = 0;

  for (const entry of entries) {
    const rel = strip(entry.name);
    if (!rel || shouldSkip(rel)) {
      skipped++;
      continue;
    }
    const buf = await entry.async("nodebuffer");
    if (buf.length > MAX_BYTES || isBinary(buf)) {
      skipped++;
      continue;
    }
    const dest = path.join(storageDir, rel);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buf);

    const text = buf.toString("utf8");
    records.push({
      projectId: project.id,
      relPath: rel,
      lang: langOf(rel),
      sizeBytes: buf.length,
      loc: text.length ? text.split("\n").length : 0,
      contentHash: createHash("sha256").update(buf).digest("hex"),
      isBinary: false,
    });
  }

  if (records.length) await prisma.file.createMany({ data: records });

  await prisma.project.update({
    where: { id: project.id },
    data: { status: "ready", storageRef: storageDir },
  });
  const job = await prisma.job.create({
    data: {
      projectId: project.id,
      type: "index",
      status: "done",
      progress: { files: records.length, skipped },
    },
  });

  return {
    projectId: project.id,
    jobId: job.id,
    fileCount: records.length,
    skipped,
  };
}
