// 解析稳定性压力测试：连续上传同一 fixture N 次，验证每次都解析出完整符号/调用边
// （回归保护：tree-sitter 偶发降级修复）。用法：起 dev server 后 `node tests/parse-stress.mjs [N]`。
import JSZip from "jszip";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const N = Number(process.argv[2] ?? 12);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "demo-project");

function walk(dir, base = dir, out = []) {
  for (const e of readdirSync(dir)) {
    const full = path.join(dir, e);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full));
  }
  return out;
}

async function buildZip() {
  const zip = new JSZip();
  for (const rel of walk(FIXTURE)) {
    zip.file(`demo-project/${rel.split(path.sep).join("/")}`, readFileSync(path.join(FIXTURE, rel)));
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

async function upload(buf, i) {
  const fd = new FormData();
  fd.append("file", new Blob([buf]), "demo.zip");
  fd.append("name", `stress-${i}`);
  const r = await fetch(BASE + "/api/projects", { method: "POST", body: fd });
  return r.json();
}

const buf = await buildZip();
let okCount = 0;
const bad = [];
for (let i = 1; i <= N; i++) {
  const res = await upload(buf, i);
  const sym = res.parsed?.symbols ?? 0;
  const edges = res.parsed?.edges ?? 0;
  const good = sym >= 8 && edges >= 3;
  console.log(`  #${i}: symbols=${sym} edges=${edges} ${good ? "✓" : "✗"}`);
  if (good) okCount++;
  else bad.push(i);
}
console.log(`\n${okCount}/${N} 次解析完整`);
if (bad.length) {
  console.log(`降级出现在第 ${bad.join(", ")} 次`);
  process.exit(1);
}
console.log("稳定 ✅");
