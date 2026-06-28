import path from "node:path";
import { readFile } from "node:fs/promises";
import Parser from "web-tree-sitter";

/**
 * tree-sitter 运行时与 grammar 加载（web-tree-sitter 0.20，ABI 与 tree-sitter-wasms 对齐）。
 * web-tree-sitter 是 CJS（module.exports = Parser 类）。webpack 的 default-interop 在 HMR 下
 * 可能把默认导出包成 {default: Parser}，导致 `Parser.init is not a function`——故调用时用 ctor() 再解析一次。
 */

export type TSNode = Parser.SyntaxNode;
export type TSParser = Parser;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ctor(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m: any = Parser;
  if (m && typeof m.init === "function") return m;
  if (m?.default && typeof m.default.init === "function") return m.default;
  return m;
}

const WTS_DIR = path.join(process.cwd(), "node_modules", "web-tree-sitter");
const GRAMMAR_DIR = path.join(
  process.cwd(),
  "node_modules",
  "tree-sitter-wasms",
  "out",
);

const GRAMMAR_FILE = {
  typescript: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
  javascript: "tree-sitter-javascript.wasm",
  python: "tree-sitter-python.wasm",
} as const;

export type Grammar = keyof typeof GRAMMAR_FILE;

/** 按文件路径选 grammar；不支持的返回 null。 */
export function grammarForPath(rel: string): Grammar | null {
  if (/\.tsx$/i.test(rel)) return "tsx";
  if (/\.ts$/i.test(rel)) return "typescript";
  if (/\.(js|jsx|mjs|cjs)$/i.test(rel)) return "javascript";
  if (/\.py$/i.test(rel)) return "python";
  return null;
}

let initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = ctor().init({
      locateFile: (name: string) => path.join(WTS_DIR, name),
    }) as Promise<void>;
  }
  return initPromise;
}

/**
 * 不跨 parseProject 缓存 Language：每次上传都用干净的 grammar 实例，避免长生命周期
 * dev server 多次解析后 WASM 状态累积污染（偶发漏边）。run 内由 parseProject 自行复用。
 */
export async function loadLanguage(grammar: Grammar): Promise<Parser.Language> {
  await ensureInit();
  const bytes = await readFile(path.join(GRAMMAR_DIR, GRAMMAR_FILE[grammar]));
  return ctor().Language.load(new Uint8Array(bytes));
}

export async function createParser(grammar: Grammar): Promise<Parser> {
  const language = await loadLanguage(grammar);
  const P = ctor();
  const parser = new P();
  parser.setLanguage(language);
  return parser;
}

/** 重置运行时（解析失败重试前调用，强制下次重新 init WASM）。 */
export function resetRuntime(): void {
  initPromise = null;
}
