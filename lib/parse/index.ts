import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { STORAGE_ROOT } from "@/lib/import";
import { createParser, grammarForPath, resetRuntime, type Grammar, type TSParser } from "./loader";
import {
  extractCalls,
  extractChunks,
  extractImports,
  extractSymbols,
  type ExtractedCall,
  type ExtractedChunk,
  type ExtractedImport,
  type ExtractedSymbol,
} from "./extract";
import { buildResolveContext, resolveCallee, type FileParse } from "./resolve";

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
  imports: ExtractedImport[];
  chunks: ExtractedChunk[];
}

/**
 * 解析项目所有可识别源文件 → symbols / symbol_refs / call_edges（确定性，可重入）。
 * 偶发降级（WASM 状态污染）兜底：一次 runParse 若可解析文件存在却产出 0 符号，
 * 重置运行时并重试一次。
 */
export async function parseProject(projectId: string): Promise<ParseResult> {
  try {
    return await runParse(projectId);
  } catch (e) {
    resetRuntime();
    console.warn("[parse] 首次失败，重置运行时重试:", e instanceof Error ? e.message : e);
    return await runParse(projectId);
  }
}

async function runParse(projectId: string): Promise<ParseResult> {
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
    let tree = parser.parse(content);
    // 偶发降级兜底：解析失败或产生 ERROR 节点时，用全新 parser 重解析一次。
    if (!tree || tree.rootNode.hasError()) {
      tree?.delete();
      parser.delete();
      parser = await createParser(grammar);
      parsers.set(grammar, parser);
      tree = parser.parse(content);
    }
    if (!tree) continue;
    const symbols = extractSymbols(tree.rootNode, grammar);
    const calls = extractCalls(tree.rootNode, grammar);
    const imports = extractImports(tree.rootNode, grammar);
    const chunks = extractChunks(tree.rootNode, grammar);
    tree.delete();
    work.push({ fileId: f.id, relPath: f.relPath, symbols, calls, imports, chunks });
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

  for (const w of work)
    for (const s of w.symbols)
      s.id = idByKey.get(keyOf(w.fileId, s.name, s.startLine, s.kind));

  // import-aware 解析索引（同文件 > import 来源 > 全局兜底，带置信度）
  const ctx = buildResolveContext(
    work.map((w): FileParse => ({ relPath: w.relPath, symbols: w.symbols, imports: w.imports })),
  );

  // 构造 refs（def + call）与 edges（外层函数 → callee，带 confidence）
  const refRows: {
    symbolId: string;
    projectId: string;
    refFileId: string;
    refLine: number;
    refKind: "def" | "call";
  }[] = [];
  const edgeAgg = new Map<
    string,
    { caller: string; callee: string; count: number; confidence: number }
  >();

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

    // 外层函数（function/method）按 index 范围，便于定位调用者（取最内层）
    const enclosers = w.symbols
      .filter((s) => s.id && (s.kind === "function" || s.kind === "method"))
      .sort((a, b) => a.startIndex - b.startIndex);
    const enclosingOf = (idx: number): (ExtractedSymbol & { id?: string }) | undefined => {
      let best: (ExtractedSymbol & { id?: string }) | undefined;
      for (const s of enclosers)
        if (s.startIndex <= idx && idx < s.endIndex)
          if (!best || s.startIndex > best.startIndex) best = s;
      return best;
    };

    for (const c of w.calls) {
      const caller = enclosingOf(c.index);
      const resolved = resolveCallee(c, w.relPath, caller, ctx);
      if (!resolved) continue;
      refRows.push({
        symbolId: resolved.calleeId,
        projectId,
        refFileId: w.fileId,
        refLine: c.line,
        refKind: "call",
      });
      if (caller?.id && caller.id !== resolved.calleeId) {
        const k = `${caller.id}|${resolved.calleeId}`;
        const e = edgeAgg.get(k);
        if (e) {
          e.count++;
          e.confidence = Math.max(e.confidence, resolved.confidence);
        } else {
          edgeAgg.set(k, {
            caller: caller.id,
            callee: resolved.calleeId,
            count: 1,
            confidence: resolved.confidence,
          });
        }
      }
    }
  }

  if (refRows.length) await prisma.symbolRef.createMany({ data: refRows });

  const edgeRows = [...edgeAgg.values()].map((e) => ({
    projectId,
    callerSymbolId: e.caller,
    calleeSymbolId: e.callee,
    refCount: e.count,
    confidence: e.confidence,
  }));
  if (edgeRows.length) await prisma.callEdge.createMany({ data: edgeRows });

  // code_chunks（泛化检索 B 的结构指纹底座）
  await prisma.codeChunk.deleteMany({ where: { projectId } });
  const chunkRows = work.flatMap((w) =>
    w.chunks.map((c) => ({
      projectId,
      fileId: w.fileId,
      startLine: c.startLine,
      endLine: c.endLine,
      kind: c.kind,
      symbol: `${w.relPath}#${c.symbol}`,
      astFingerprint: c.fingerprint,
      normalizedText: c.normalized,
    })),
  );
  if (chunkRows.length) await prisma.codeChunk.createMany({ data: chunkRows });

  return { symbols: symbolRows.length, refs: refRows.length, edges: edgeRows.length };
}
