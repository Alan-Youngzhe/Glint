import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { STORAGE_ROOT } from "@/lib/import";
import { createParser, grammarForPath, type Grammar, type TSParser } from "./loader";
import {
  extractCalls,
  extractSymbols,
  type ExtractedCall,
  type ExtractedSymbol,
  type SymKind,
} from "./extract";

export interface ParseResult {
  symbols: number;
  refs: number;
  edges: number;
}

interface FileWork {
  fileId: string;
  relPath: string;
  symbols: (ExtractedSymbol & { id?: string })[];
  calls: ExtractedCall[];
}

const KIND_RANK: Record<SymKind, number> = {
  function: 0,
  method: 1,
  class: 2,
  variable: 3,
};

/** 解析项目所有可识别源文件 → symbols / symbol_refs / call_edges（确定性，可重入）。 */
export async function parseProject(projectId: string): Promise<ParseResult> {
  const files = await prisma.file.findMany({
    where: { projectId },
    select: { id: true, relPath: true },
  });

  const baseDir = path.join(STORAGE_ROOT, projectId);
  const parsers = new Map<Grammar, TSParser>();
  const work: FileWork[] = [];

  for (const f of files) {
    const grammar = grammarForPath(f.relPath);
    if (!grammar) continue;
    let parser = parsers.get(grammar);
    if (!parser) {
      parser = await createParser(grammar);
      parsers.set(grammar, parser);
    }
    let content: string;
    try {
      content = await readFile(path.join(baseDir, f.relPath), "utf8");
    } catch {
      continue;
    }
    const tree = parser.parse(content);
    if (!tree) continue;
    const symbols = extractSymbols(tree.rootNode, grammar);
    const calls = extractCalls(tree.rootNode, grammar);
    tree.delete();
    work.push({ fileId: f.id, relPath: f.relPath, symbols, calls });
  }
  parsers.forEach((p) => p.delete());

  // 重入：清掉旧结果（symbol 删除级联 symbol_refs；call_edges 需手动删）。
  await prisma.callEdge.deleteMany({ where: { projectId } });
  await prisma.symbol.deleteMany({ where: { projectId } });

  // 写 symbols
  const symbolRows = work.flatMap((w) =>
    w.symbols.map((s) => ({
      projectId,
      fileId: w.fileId,
      kind: s.kind,
      name: s.name,
      qualifiedName: `${w.relPath}#${s.name}`,
      startLine: s.startLine,
      endLine: s.endLine,
      signature: s.signature,
    })),
  );
  if (symbolRows.length) await prisma.symbol.createMany({ data: symbolRows });

  // 取回 id，回填到内存符号（按 fileId+startLine+name+kind 匹配）
  const dbSymbols = await prisma.symbol.findMany({
    where: { projectId },
    select: { id: true, fileId: true, name: true, startLine: true, kind: true },
  });
  const keyOf = (fileId: string, name: string, startLine: number, kind: string) =>
    `${fileId}:${startLine}:${name}:${kind}`;
  const idByKey = new Map<string, string>();
  for (const s of dbSymbols)
    idByKey.set(keyOf(s.fileId, s.name, s.startLine, s.kind), s.id);

  // 全局 name → symbolId（偏好 function/method/class）
  const nameToId = new Map<string, string>();
  const ranked = [...dbSymbols].sort(
    (a, b) =>
      KIND_RANK[a.kind as SymKind] - KIND_RANK[b.kind as SymKind],
  );
  for (const s of ranked) if (!nameToId.has(s.name)) nameToId.set(s.name, s.id);

  for (const w of work)
    for (const s of w.symbols)
      s.id = idByKey.get(keyOf(w.fileId, s.name, s.startLine, s.kind));

  // 构造 refs（def + call）与 edges（外层函数 → callee）
  const refRows: {
    symbolId: string;
    projectId: string;
    refFileId: string;
    refLine: number;
    refKind: "def" | "call";
  }[] = [];
  const edgeAgg = new Map<string, { caller: string; callee: string; count: number }>();

  for (const w of work) {
    // def
    for (const s of w.symbols)
      if (s.id)
        refRows.push({
          symbolId: s.id,
          projectId,
          refFileId: w.fileId,
          refLine: s.startLine,
          refKind: "def",
        });

    // 外层函数（function/method）按 index 范围，便于定位调用者
    const enclosers = w.symbols
      .filter((s) => s.id && (s.kind === "function" || s.kind === "method"))
      .sort((a, b) => a.startIndex - b.startIndex);
    const enclosingOf = (idx: number): string | undefined => {
      let best: (ExtractedSymbol & { id?: string }) | undefined;
      for (const s of enclosers)
        if (s.startIndex <= idx && idx < s.endIndex)
          if (!best || s.startIndex > best.startIndex) best = s;
      return best?.id;
    };

    for (const c of w.calls) {
      const calleeId = nameToId.get(c.calleeName);
      if (!calleeId) continue;
      refRows.push({
        symbolId: calleeId,
        projectId,
        refFileId: w.fileId,
        refLine: c.line,
        refKind: "call",
      });
      const callerId = enclosingOf(c.index);
      if (callerId && callerId !== calleeId) {
        const k = `${callerId}|${calleeId}`;
        const e = edgeAgg.get(k);
        if (e) e.count++;
        else edgeAgg.set(k, { caller: callerId, callee: calleeId, count: 1 });
      }
    }
  }

  if (refRows.length) await prisma.symbolRef.createMany({ data: refRows });

  const edgeRows = [...edgeAgg.values()].map((e) => ({
    projectId,
    callerSymbolId: e.caller,
    calleeSymbolId: e.callee,
    refCount: e.count,
  }));
  if (edgeRows.length) await prisma.callEdge.createMany({ data: edgeRows });

  return { symbols: symbolRows.length, refs: refRows.length, edges: edgeRows.length };
}
