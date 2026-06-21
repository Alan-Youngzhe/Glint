// Glint 端到端测试：打包 fixture → 上传 → 串起 M1–M4 全链路逐项断言。
// 用法：先起 dev server（pnpm dev / preview），再 `node tests/e2e.mjs`。
// 兼容无 key 降级：LLM 部分只断言"有返回/降级文案"，不断言智能内容。
import JSZip from "jszip";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "demo-project");

let pass = 0;
let fail = 0;
const fails = [];
function ok(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    fails.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function section(t) {
  console.log(`\n▶ ${t}`);
}

function walk(dir, base = dir, out = []) {
  for (const e of readdirSync(dir)) {
    const full = path.join(dir, e);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full));
  }
  return out;
}

async function getJSON(url) {
  const r = await fetch(BASE + url);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}
async function postJSON(url, body) {
  const r = await fetch(BASE + url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}
async function postSSE(url, body) {
  const events = [];
  const r = await fetch(BASE + url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const p of parts) {
      const line = p.trim();
      if (line.startsWith("data:")) {
        const j = line.slice(5).trim();
        if (j) events.push(JSON.parse(j));
      }
    }
  }
  return events;
}
async function symbolId(projectId, file, name) {
  const d = await getJSON(`/api/symbols?projectId=${projectId}&file=${encodeURIComponent(file)}`);
  return d.symbols.find((s) => s.name === name)?.id;
}

async function main() {
  console.log(`Glint E2E · ${BASE}`);

  section("0. 服务可达");
  const root = await fetch(BASE + "/");
  ok("GET / 200", root.status === 200, `status=${root.status}`);

  section("1. 上传 + 索引 + 过滤 + 解析 + 预理解 (M1/M2)");
  const zip = new JSZip();
  for (const rel of walk(FIXTURE)) {
    zip.file(`demo-project/${rel.split(path.sep).join("/")}`, readFileSync(path.join(FIXTURE, rel)));
  }
  const blob = new Blob([await zip.generateAsync({ type: "nodebuffer" })]);
  const fd = new FormData();
  fd.append("file", blob, "demo.zip");
  fd.append("name", "e2e-demo");
  const up = await (await fetch(BASE + "/api/projects", { method: "POST", body: fd })).json();
  const pid = up.project?.id;
  ok("上传返回 projectId", !!pid);
  ok("收录 6 个文件", up.fileCount === 6, `fileCount=${up.fileCount}`);
  ok("过滤 node_modules + lockfile (skipped=2)", up.skipped === 2, `skipped=${up.skipped}`);
  ok("解析出 ≥8 符号", up.parsed?.symbols >= 8, `symbols=${up.parsed?.symbols}`);
  ok("解析出 ≥3 调用边", up.parsed?.edges >= 3, `edges=${up.parsed?.edges}`);
  ok("技术栈检测 ≥5 项", up.tech >= 5, `tech=${up.tech}`);
  ok("预理解出 ≥1 模块", up.pregen?.modules >= 1, `modules=${up.pregen?.modules}`);

  section("2. 浏览 (M1)");
  const list = await getJSON("/api/projects");
  ok("项目入库可列出", Array.isArray(list) && list.some((p) => p.id === pid));
  const tree = await getJSON(`/api/projects/${pid}/tree`);
  const src = tree.children?.find((c) => c.name === "src");
  ok("树含 src 目录", !!src && src.kind === "dir");
  ok("src 下有 3 个文件", (src?.children?.length ?? 0) === 3, `count=${src?.children?.length}`);
  const fc = await getJSON(`/api/projects/${pid}/files?path=src/math.ts`);
  ok("文件内容可读 (含 add)", fc.content?.includes("add") && fc.lang === "typescript");

  section("3. 符号 / 调用边 (M1)");
  const sym = await getJSON(`/api/symbols?projectId=${pid}`);
  ok("symbols ≥8 入库", sym.counts.symbols >= 8, `=${sym.counts.symbols}`);
  ok("call_edges ≥3 入库", sym.counts.edges >= 3, `=${sym.counts.edges}`);
  ok(
    "跨文件边 getProfile→requireUser",
    sym.edges.some((e) => /getProfile/.test(e.caller) && /requireUser/.test(e.callee)),
  );

  section("4. 四维理解 (M3)");
  const reqUserId = await symbolId(pid, "src/auth.ts", "requireUser");
  const cg = await postJSON("/api/understand", {
    projectId: pid,
    focus: { type: "function", ref: reqUserId },
    dimension: 2,
  });
  ok("⌥2 调用图 kind=callgraph", cg.kind === "callgraph");
  ok("⌥2 焦点 requireUser 居中", cg.nodes.some((n) => n.label === "requireUser" && n.isFocus));
  ok("⌥2 含被调用者 getSession", cg.nodes.some((n) => n.label === "getSession"));
  ok("⌥2 含调用者 getProfile", cg.nodes.some((n) => n.label === "getProfile"));

  const card = await postJSON("/api/understand", {
    projectId: pid,
    focus: { type: "file", ref: "src/auth.ts" },
    dimension: 1,
  });
  ok("⌥1 文件卡 kind=card", card.kind === "card");
  ok("⌥1 文件卡有摘要", typeof card.summary === "string" && card.summary.includes("函数"));

  const arch = await postJSON("/api/understand", {
    projectId: pid,
    focus: { type: "folder", ref: "" },
    dimension: 4,
  });
  ok("⌥4 架构 kind=architecture", arch.kind === "architecture");
  ok("⌥4 treemap 根有子节点", (arch.root?.children?.length ?? 0) > 0);

  const exec = await postJSON("/api/understand", {
    projectId: pid,
    focus: { type: "function", ref: await symbolId(pid, "src/user.ts", "getProfile") },
    dimension: 3,
  });
  ok("⌥3 执行路径 kind=execpath", exec.kind === "execpath");
  ok("⌥3 有步骤", exec.steps.length > 0, `steps=${exec.steps.length}`);

  section("5. ⌥1 选中代码流式 SSE (M3，无 key 降级)");
  const sse = await postSSE("/api/understand", {
    projectId: pid,
    focus: {
      type: "selection",
      ref: "src/math.ts",
      selection: { fileId: "src/math.ts", startLine: 2, startCol: 0, endLine: 4, endCol: 0 },
    },
    dimension: 1,
  });
  ok("SSE 有增量 delta", sse.some((e) => "delta" in e));
  const doneCard = sse.find((e) => "done" in e)?.done;
  ok("SSE 末尾 done 卡片", !!doneCard && doneCard.kind === "card");
  ok("done 卡片含 explanation", !!doneCard?.explanation?.language);

  section("6. 技术栈 + 架构直读 (M2)");
  const ts = await getJSON(`/api/projects/${pid}/techstack`);
  ok("技术栈含 next", ts.some((t) => t.slug === "next" && t.kind === "framework"));
  ok("技术栈含 TypeScript 语言", ts.some((t) => t.slug === "typescript" && t.kind === "language"));
  const tech = await getJSON(`/api/tech/next`);
  ok("认知卡片有返回(降级亦可)", typeof tech.what === "string" && tech.what.length > 0);
  const archGet = await getJSON(`/api/projects/${pid}/architecture`);
  ok("架构直读 techStack 非空", (archGet.techStack?.length ?? 0) > 0);

  section("7. 泛化检索 (M4-B)");
  const addId = await symbolId(pid, "src/math.ts", "add");
  const gen = await postJSON("/api/search/generalize", {
    projectId: pid,
    focus: { type: "function", ref: addId },
  });
  ok("add 命中孪生 mul", gen.hits.some((h) => /mul/.test(h.ref)));
  ok("add 命中孪生 sub", gen.hits.some((h) => /sub/.test(h.ref)));

  section("8. 交互事件 + 成长分析 (M3/M4-D)");
  const ev = await postJSON("/api/events", {
    projectId: pid,
    events: [
      { action: "dim1", focusType: "file", focusRef: "src/auth.ts", ts: "2026-06-21T01:00:00Z" },
      { action: "dim2", focusType: "file", focusRef: "src/auth.ts", ts: "2026-06-21T01:01:00Z" },
      { action: "drill", focusType: "file", focusRef: "src/auth.ts", ts: "2026-06-21T01:05:00Z" },
    ],
  });
  ok("事件入库 ok", ev.ok === true && ev.count === 3);
  const weak = await getJSON(`/api/insights/weak-points?projectId=${pid}`);
  ok("弱项看板聚合出 auth.ts", weak.some((w) => /auth\.ts/.test(w.slug) && w.askCount >= 3));

  section("9. Agent Bar (M3/M4-C, SSE, 无 key 降级)");
  const ag = await postSSE("/api/agent", { projectId: pid, message: "这个项目怎么做鉴权的？" });
  ok("Agent 有 token 流", ag.some((e) => e.type === "token"));
  ok("Agent 有引用(RAG/模块)", ag.some((e) => e.type === "citation"));
  ok("Agent 有建议", ag.some((e) => e.type === "suggestion"));
  ok("Agent 有 done", ag.some((e) => e.type === "done"));

  console.log(`\n${"─".repeat(40)}`);
  console.log(`通过 ${pass} · 失败 ${fail}`);
  if (fail) {
    console.log(`失败项: ${fails.join(", ")}`);
    process.exit(1);
  }
  console.log("全部通过 ✅");
}

main().catch((e) => {
  console.error("\nE2E 异常:", e);
  process.exit(1);
});
