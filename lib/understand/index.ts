import { prisma } from "@/lib/db";
import { getArchitecture } from "@/lib/pregen/architecture";
import { writeQueryLog } from "./log";
import type {
  CallGraphPayload,
  CardPayload,
  ExecPathPayload,
  Focus,
  GraphEdge,
  GraphNode,
  UnderstandRequest,
  UnderstandResponse,
} from "@/types/contract";

/** 四维派发（V3 §6.2 / §8）——确定性优先，LLM 部分在 stream/懒生成里降级。 */
export async function understand(
  req: UnderstandRequest,
): Promise<UnderstandResponse> {
  switch (req.dimension) {
    case 2:
      return callGraphFor(req);
    case 3:
      return execPathFor(req);
    case 4:
      return { ...(await getArchitecture(req.projectId)), focus: req.focus };
    case 1:
    default: {
      const card = await cardFor(req);
      writeQueryLog(req.projectId, req.focus, card);
      return card;
    }
  }
}

const GKIND: Record<string, GraphNode["kind"]> = {
  function: "function",
  method: "function",
  class: "class",
  variable: "function",
};

/** 把焦点解析成「焦点符号 id 集合」（symbol 焦点=自身；file 焦点=文件内全部符号）。 */
async function focusSymbolIds(projectId: string, focus: Focus): Promise<string[]> {
  if (focus.type === "function" || focus.type === "class" || focus.type === "variable") {
    return [focus.ref];
  }
  if (focus.type === "file" || focus.type === "selection") {
    const file = await prisma.file.findFirst({
      where: { projectId, relPath: focus.ref },
      select: { id: true },
    });
    if (!file) return [];
    const syms = await prisma.symbol.findMany({
      where: { projectId, fileId: file.id },
      select: { id: true },
    });
    return syms.map((s) => s.id);
  }
  return [];
}

// ===== ⌥2 调用图（call_edges 确定性 + 连线 NL；LOD 深度 + 模块折叠） =====
const GRAPH_MAX_NODES = 60; // N 跳爆炸保护

/** 顶层模块（文件 relPath 的首段）。 */
function topModule(rel: string): string {
  const i = rel.indexOf("/");
  return i === -1 ? "(root)" : rel.slice(0, i);
}

async function callGraphFor(req: UnderstandRequest): Promise<CallGraphPayload> {
  const { projectId, focus } = req;
  const depth = Math.max(1, Math.min(req.graph?.depth ?? 1, 3));
  const level = req.graph?.level ?? "function";
  const focusSet = new Set(await focusSymbolIds(projectId, focus));
  const view = { depth, level };

  // 全量边 → 无向邻接，从焦点 BFS 取 N 跳
  const allEdges = await prisma.callEdge.findMany({ where: { projectId } });
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    let s = adj.get(a);
    if (!s) adj.set(a, (s = new Set()));
    s.add(b);
  };
  for (const e of allEdges) {
    link(e.callerSymbolId, e.calleeSymbolId);
    link(e.calleeSymbolId, e.callerSymbolId);
  }
  const visited = new Set<string>(focusSet);
  let frontier = [...focusSet];
  for (let d = 0; d < depth && visited.size < GRAPH_MAX_NODES; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const nb of adj.get(id) ?? []) {
        if (visited.has(nb)) continue;
        visited.add(nb);
        next.push(nb);
        if (visited.size >= GRAPH_MAX_NODES) break;
      }
      if (visited.size >= GRAPH_MAX_NODES) break;
    }
    frontier = next;
  }
  const subEdges = allEdges.filter(
    (e) => visited.has(e.callerSymbolId) && visited.has(e.calleeSymbolId),
  );

  const syms = await prisma.symbol.findMany({
    where: { id: { in: [...visited] } },
    select: { id: true, name: true, kind: true, fileId: true },
  });
  const byId = new Map(syms.map((s) => [s.id, s]));

  if (level === "module") {
    // symbol → 模块（其文件首段目录）
    const fileIds = [...new Set(syms.map((s) => s.fileId))];
    const files = await prisma.file.findMany({
      where: { id: { in: fileIds } },
      select: { id: true, relPath: true },
    });
    const moduleOfFile = new Map(files.map((f) => [f.id, topModule(f.relPath)]));
    const moduleOf = (symId: string) => {
      const s = byId.get(symId);
      return s ? moduleOfFile.get(s.fileId) : undefined;
    };
    const focusModules = new Set([...focusSet].map(moduleOf).filter(Boolean) as string[]);

    const modNames = new Set<string>();
    for (const s of syms) {
      const m = moduleOfFile.get(s.fileId);
      if (m) modNames.add(m);
    }
    const nodes: GraphNode[] = [...modNames].map((m) => ({
      id: m,
      label: m === "(root)" ? "(root)" : m,
      kind: "module",
      isFocus: focusModules.has(m),
    }));
    // 跨模块边聚合（去自环，取最大 confidence）
    const agg = new Map<string, { from: string; to: string; count: number; confidence: number }>();
    for (const e of subEdges) {
      const a = moduleOf(e.callerSymbolId);
      const b = moduleOf(e.calleeSymbolId);
      if (!a || !b || a === b) continue;
      const k = `${a}|${b}`;
      const cur = agg.get(k);
      if (cur) {
        cur.count += e.refCount;
        cur.confidence = Math.max(cur.confidence, e.confidence);
      } else {
        agg.set(k, { from: a, to: b, count: e.refCount, confidence: e.confidence });
      }
    }
    const edges: GraphEdge[] = [...agg.values()].map((e) => ({
      from: e.from,
      to: e.to,
      relation: "calls" as const,
      nl: `${e.from} → ${e.to}`,
      confidence: e.confidence,
    }));
    return { kind: "callgraph", focus, nodes, edges, source: "call_edges (module)", view };
  }

  const nodes: GraphNode[] = syms.map((s) => ({
    id: s.id,
    label: s.name,
    kind: GKIND[s.kind] ?? "function",
    isFocus: focusSet.has(s.id),
  }));
  const gEdges: GraphEdge[] = subEdges.map((e) => ({
    from: e.callerSymbolId,
    to: e.calleeSymbolId,
    relation: "calls" as const,
    nl: `${byId.get(e.callerSymbolId)!.name} calls ${byId.get(e.calleeSymbolId)!.name}`,
    confidence: e.confidence,
  }));

  return {
    kind: "callgraph",
    focus,
    nodes,
    edges: gEdges,
    source: "symbol_refs+call_edges",
    view,
  };
}

// ===== ⌥3 执行路径（call_edges 静态 trace，标注近似） =====
async function execPathFor(req: UnderstandRequest): Promise<ExecPathPayload> {
  const { projectId, focus } = req;
  const starts = await focusSymbolIds(projectId, focus);
  const steps: ExecPathPayload["steps"] = [];

  if (starts.length) {
    const all = await prisma.symbol.findMany({
      where: { projectId },
      select: { id: true, name: true, fileId: true, startLine: true },
    });
    const byId = new Map(all.map((s) => [s.id, s]));
    const files = await prisma.file.findMany({
      where: { projectId },
      select: { id: true, relPath: true },
    });
    const relById = new Map(files.map((f) => [f.id, f.relPath]));

    const edges = await prisma.callEdge.findMany({ where: { projectId } });
    const calleesOf = new Map<string, string[]>();
    edges.forEach((e) => {
      const arr = calleesOf.get(e.callerSymbolId) ?? [];
      arr.push(e.calleeSymbolId);
      calleesOf.set(e.callerSymbolId, arr);
    });

    // 从焦点 DFS 跟随被调用者（限深限量，去重）
    const seen = new Set<string>();
    let order = 1;
    const visit = (id: string, depth: number) => {
      if (seen.has(id) || depth > 6 || steps.length > 20) return;
      seen.add(id);
      const s = byId.get(id);
      if (s) {
        steps.push({
          order: order++,
          symbol: s.name,
          at: `${relById.get(s.fileId) ?? "?"}:${s.startLine}`,
          describe: depth === 0 ? "Entry" : `Step ${depth}`,
        });
      }
      for (const c of calleesOf.get(id) ?? []) visit(c, depth + 1);
    };
    visit(starts[0], 0);
  }

  return {
    kind: "execpath",
    focus,
    steps,
    note: "Approximate path: inferred from static call edges; dynamic branches not expanded (deepened in M4).",
    source: "call_edges(approx)",
  };
}

// ===== ⌥1 卡片（file/module/function/class/variable，确定性；selection 走 stream） =====
async function cardFor(req: UnderstandRequest): Promise<CardPayload> {
  const { projectId, focus } = req;

  if (focus.type === "variable" || focus.type === "function" || focus.type === "class") {
    const sym = await prisma.symbol.findUnique({ where: { id: focus.ref } });
    if (!sym) {
      return { kind: "card", focus, title: focus.ref, source: "ast", summary: "(symbol not found)" };
    }
    const file = await prisma.file.findUnique({ where: { id: sym.fileId }, select: { relPath: true } });

    if (focus.type === "variable") {
      const refs = await prisma.symbolRef.findMany({ where: { symbolId: sym.id } });
      const files = await prisma.file.findMany({
        where: { projectId },
        select: { id: true, relPath: true },
      });
      const relById = new Map(files.map((f) => [f.id, f.relPath]));
      return {
        kind: "card",
        focus,
        title: sym.name,
        source: "ast",
        canPin: true,
        variableRefs: {
          definedAt: `${file?.relPath ?? "?"}:${sym.startLine}`,
          reads: refs.filter((r) => r.refKind === "read").length,
          writes: refs.filter((r) => r.refKind === "write").length,
          usedBy: refs
            .filter((r) => r.refKind !== "def")
            .map((r) => ({ symbol: "", at: `${relById.get(r.refFileId) ?? "?"}:${r.refLine}` })),
        },
      };
    }

    // function / class：签名 + 调用者/被调用者计数（确定性）
    const [callers, callees] = await Promise.all([
      prisma.callEdge.count({ where: { projectId, calleeSymbolId: sym.id } }),
      prisma.callEdge.count({ where: { projectId, callerSymbolId: sym.id } }),
    ]);
    return {
      kind: "card",
      focus,
      title: sym.name,
      source: "symbol_card",
      canPin: true,
      summary: `${sym.kind} ${sym.name} (${file?.relPath ?? ""}:${sym.startLine}). Called from ${callers} place(s), calls ${callees} target(s).${sym.signature ? `\nSignature: ${sym.signature}` : ""}`,
      drillTo: { scope: sym.qualifiedName ?? sym.name },
    };
  }

  if (focus.type === "module" || focus.type === "folder") {
    const mod = await prisma.module.findFirst({
      where: { projectId, name: focus.ref },
    });
    return {
      kind: "card",
      focus,
      title: focus.ref,
      source: "modules",
      canPin: true,
      summary: mod
        ? `${mod.responsibility ?? ""}${(mod.dependsOn as string[] | null)?.length ? `\nDepends on: ${(mod.dependsOn as string[]).join(", ")}` : ""}`
        : "(no module info)",
    };
  }

  // file（含 selection 的非流式兜底）
  const file = await prisma.file.findFirst({
    where: { projectId, relPath: focus.ref },
    select: { id: true, relPath: true, lang: true, loc: true },
  });
  if (!file) {
    return { kind: "card", focus, title: focus.ref, source: "file_summaries", summary: "(file not found)" };
  }
  const syms = await prisma.symbol.findMany({
    where: { projectId, fileId: file.id },
    select: { name: true, kind: true },
    orderBy: { startLine: "asc" },
  });
  const fns = syms.filter((s) => s.kind === "function" || s.kind === "method");
  const classes = syms.filter((s) => s.kind === "class");
  return {
    kind: "card",
    focus,
    title: file.relPath,
    source: "file_summaries",
    canPin: true,
    summary: `${file.lang} file, ${file.loc} lines. Defines ${fns.length} function(s)${classes.length ? `, ${classes.length} class(es)` : ""}${fns.length ? `: ${fns.slice(0, 6).map((s) => s.name).join(", ")}` : ""}.`,
  };
}
