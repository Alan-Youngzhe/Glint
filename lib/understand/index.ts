import { prisma } from "@/lib/db";
import { getArchitecture } from "@/lib/pregen/architecture";
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
    default:
      return cardFor(req);
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

// ===== ⌥2 调用图（call_edges 确定性 + 连线 NL） =====
async function callGraphFor(req: UnderstandRequest): Promise<CallGraphPayload> {
  const { projectId, focus } = req;
  const focusSet = new Set(await focusSymbolIds(projectId, focus));

  const edges = await prisma.callEdge.findMany({
    where: {
      projectId,
      OR: [
        { callerSymbolId: { in: [...focusSet] } },
        { calleeSymbolId: { in: [...focusSet] } },
      ],
    },
  });

  const idSet = new Set<string>(focusSet);
  edges.forEach((e) => {
    idSet.add(e.callerSymbolId);
    idSet.add(e.calleeSymbolId);
  });

  const syms = await prisma.symbol.findMany({
    where: { id: { in: [...idSet] } },
    select: { id: true, name: true, kind: true, qualifiedName: true },
  });
  const byId = new Map(syms.map((s) => [s.id, s]));

  const nodes: GraphNode[] = syms.map((s) => ({
    id: s.id,
    label: s.name,
    kind: GKIND[s.kind] ?? "function",
    isFocus: focusSet.has(s.id),
  }));

  const gEdges: GraphEdge[] = edges
    .filter((e) => byId.has(e.callerSymbolId) && byId.has(e.calleeSymbolId))
    .map((e) => ({
      from: e.callerSymbolId,
      to: e.calleeSymbolId,
      relation: "calls" as const,
      nl: `${byId.get(e.callerSymbolId)!.name} 调用 ${byId.get(e.calleeSymbolId)!.name}`,
    }));

  return {
    kind: "callgraph",
    focus,
    nodes,
    edges: gEdges,
    source: "symbol_refs+call_edges",
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
          describe: depth === 0 ? "入口" : `第 ${depth} 步`,
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
    note: "近似路径：基于静态调用边推断，动态分支未展开（四期深化）。",
    source: "call_edges(approx)",
  };
}

// ===== ⌥1 卡片（file/module/function/class/variable，确定性；selection 走 stream） =====
async function cardFor(req: UnderstandRequest): Promise<CardPayload> {
  const { projectId, focus } = req;

  if (focus.type === "variable" || focus.type === "function" || focus.type === "class") {
    const sym = await prisma.symbol.findUnique({ where: { id: focus.ref } });
    if (!sym) {
      return { kind: "card", focus, title: focus.ref, source: "ast", summary: "（未找到符号）" };
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
      summary: `${sym.kind} ${sym.name}（${file?.relPath ?? ""}:${sym.startLine}）。被 ${callers} 处调用，调用了 ${callees} 个目标。${sym.signature ? `\n签名：${sym.signature}` : ""}`,
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
        ? `${mod.responsibility ?? ""}${(mod.dependsOn as string[] | null)?.length ? `\n依赖：${(mod.dependsOn as string[]).join("、")}` : ""}`
        : "（无模块信息）",
    };
  }

  // file（含 selection 的非流式兜底）
  const file = await prisma.file.findFirst({
    where: { projectId, relPath: focus.ref },
    select: { id: true, relPath: true, lang: true, loc: true },
  });
  if (!file) {
    return { kind: "card", focus, title: focus.ref, source: "file_summaries", summary: "（未找到文件）" };
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
    summary: `${file.lang} 文件，${file.loc} 行。定义了 ${fns.length} 个函数${classes.length ? `、${classes.length} 个类` : ""}${fns.length ? `：${fns.slice(0, 6).map((s) => s.name).join("、")}` : ""}。`,
  };
}
