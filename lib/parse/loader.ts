import path from "node:path";
import { readFile } from "node:fs/promises";
import Parser from "web-tree-sitter";

/** tree-sitter 运行时与 grammar 加载（web-tree-sitter 0.20，ABI 与 tree-sitter-wasms 对齐）。 */

export type TSNode = Parser.SyntaxNode;
export type TSParser = Parser;

const WTS_DIR = path.join(process.cwd(), "node_modules", "web-tree-sitter");
const GRAMMAR_DIR = path.join(
  process.cwd(),
  "node_modules",
  "tree-sitter-wasms",
  "out",
);

/** 我们识别的 grammar（按文件扩展名选，tsx/jsx 用对应 grammar）。 */
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
const langCache = new Map<Grammar, Parser.Language>();

function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = Parser.init({
      locateFile: (name: string) => path.join(WTS_DIR, name),
    });
  }
  return initPromise;
}

export async function loadLanguage(grammar: Grammar): Promise<Parser.Language> {
  const cached = langCache.get(grammar);
  if (cached) return cached;
  await ensureInit();
  const bytes = await readFile(path.join(GRAMMAR_DIR, GRAMMAR_FILE[grammar]));
  const language = await Parser.Language.load(new Uint8Array(bytes));
  langCache.set(grammar, language);
  return language;
}

export async function createParser(grammar: Grammar): Promise<Parser> {
  const language = await loadLanguage(grammar);
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}
