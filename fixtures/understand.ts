import type {
  CallGraphPayload,
  CardPayload,
  ExecPathPayload,
  UnderstandRequest,
  UnderstandResponse,
} from "@/types/contract";
import { architectureFixture } from "@/fixtures/architecture";

/** ⌥1 卡片：选中代码 / 文件 / 变量焦点。 */
function cardFor(req: UnderstandRequest): CardPayload {
  const { focus } = req;

  if (focus.type === "variable") {
    return {
      kind: "card",
      focus,
      title: focus.ref.split("#").pop() ?? focus.ref,
      source: "ast",
      canPin: true,
      variableRefs: {
        definedAt: "auth/guard.ts:4",
        reads: 3,
        writes: 1,
        usedBy: [
          { symbol: "requireUser", at: "auth/guard.ts:5" },
          { symbol: "getProfile", at: "api/user.ts:4" },
          { symbol: "listOrders", at: "api/order.ts:4" },
        ],
      },
    };
  }

  if (focus.type === "selection") {
    return {
      kind: "card",
      focus,
      title: "选中代码",
      source: "realtime",
      canPin: true,
      explanation: {
        language: "TypeScript",
        syntax: ["async/await", "可选链 ?."],
        lineByLine: [
          {
            lines: "4-6",
            explain: "取出会话，若不存在就抛出 UNAUTHORIZED",
            why: "把登录校验收敛到守卫里，业务代码不必各自判断",
          },
        ],
        positionInContext: "在 requireUser 守卫函数中，作为返回前的前置校验",
        role: "保证后续逻辑只对已登录用户执行",
        concepts: [
          { slug: "async", name: "异步", confidence: 0.9 },
          { slug: "guard-clause", name: "守卫语句", confidence: 0.8 },
        ],
        generalization: [{ where: "api/order.ts:4", note: "同样的守卫模式" }],
      },
    };
  }

  // file / module / function / class：直读角色卡片
  return {
    kind: "card",
    focus,
    title: focus.ref,
    source: focus.type === "module" ? "modules" : "file_summaries",
    canPin: true,
    summary:
      "统一的登录守卫：在业务逻辑执行前校验会话，未登录直接抛错，是 api/* 端点的公共前置。",
  };
}

/** ⌥2 调用图（确定性 + 连线 NL，mock 8 节点内）。 */
function callGraphFor(req: UnderstandRequest): CallGraphPayload {
  const focusId = "auth/guard.ts#requireUser";
  return {
    kind: "callgraph",
    focus: req.focus,
    source: "symbol_refs+edge_cache",
    nodes: [
      { id: "api/user.ts#getProfile", label: "getProfile", kind: "function" },
      { id: "api/order.ts#listOrders", label: "listOrders", kind: "function" },
      { id: focusId, label: "requireUser", kind: "function", isFocus: true },
      { id: "auth/session.ts#getSession", label: "getSession", kind: "function" },
    ],
    edges: [
      {
        from: "api/user.ts#getProfile",
        to: focusId,
        relation: "calls",
        nl: "getProfile 在返回资料前先调用 requireUser 校验登录",
      },
      {
        from: "api/order.ts#listOrders",
        to: focusId,
        relation: "calls",
        nl: "listOrders 同样先经守卫确认登录态",
      },
      {
        from: focusId,
        to: "auth/session.ts#getSession",
        relation: "calls",
        nl: "requireUser 委托 getSession 解析请求中的会话",
      },
    ],
  };
}

/** ⌥3 执行路径（mock，标注近似）。 */
function execPathFor(req: UnderstandRequest): ExecPathPayload {
  return {
    kind: "execpath",
    focus: req.focus,
    source: "call_edges+trace(approx)",
    note: "近似路径：基于静态调用边推断，动态分支未展开。",
    steps: [
      { order: 1, symbol: "getProfile", at: "api/user.ts:3", describe: "收到请求，进入端点" },
      { order: 2, symbol: "requireUser", at: "auth/guard.ts:3", describe: "调用守卫校验登录" },
      { order: 3, symbol: "getSession", at: "auth/session.ts:5", describe: "解析 authorization 头" },
      { order: 4, symbol: "getProfile", at: "api/user.ts:5", describe: "校验通过，返回用户资料" },
    ],
  };
}

/** 按维度派发返回对应形状（施工手册 §4.3）。 */
export function understandFixture(req: UnderstandRequest): UnderstandResponse {
  switch (req.dimension) {
    case 1:
      return cardFor(req);
    case 2:
      return callGraphFor(req);
    case 3:
      return execPathFor(req);
    case 4:
      return { ...architectureFixture, focus: req.focus };
    default:
      return cardFor(req);
  }
}
