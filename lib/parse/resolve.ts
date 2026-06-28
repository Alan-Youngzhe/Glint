import path from "node:path";
import type { ExtractedCall, ExtractedImport, ExtractedSymbol } from "./extract";

/**
 * import-aware 调用解析（确定性，借鉴 pyan postprocessor / graphify symbol_resolution 的思路重写）。
 * 解析优先级（取第一个命中并定置信度）：
 *   1. this.foo()        → caller 所在类的同名方法            confidence 1.0
 *   2. foo()  同文件      → 本文件同名可调用符号               confidence 1.0
 *   3. foo()  import      → import 来源文件里的目标符号        confidence 1.0
 *   4. ns.foo() namespace → namespace import 来源文件的 foo    confidence 1.0
 *   5. 全局唯一同名                                            confidence 0.5
 *   6. 全局多同名（取 kind 排名首个，歧义）                     confidence 0.4
 * 解析不出 → null（不连边）。
 */

const CALLABLE = new Set(["function", "method", "class"]);
const JS_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

export type SymbolWithId = ExtractedSymbol & { id?: string };

export interface FileParse {
  relPath: string;
  symbols: SymbolWithId[];
  imports: ExtractedImport[];
}

export interface ResolveContext {
  /** fileRel → (name → symbolId)，仅可调用符号。 */
  fileSymbolByName: Map<string, Map<string, string>>;
  /** `${fileRel}#${class}#${method}` → symbolId。 */
  classMethodId: Map<string, string>;
  /** fileRel → (localName → import)。 */
  importsByFile: Map<string, Map<string, ExtractedImport>>;
  /** 全局 name → symbolId[]（按 kind 排名）。 */
  globalByName: Map<string, string[]>;
  /** fromModule 相对引用 → 项目内真实文件 relPath。 */
  resolveModule: (fromModule: string, callerRel: string) => string | undefined;
}

const KIND_RANK: Record<string, number> = { function: 0, method: 1, class: 2, variable: 3 };

/** 由各文件的符号 + import 预建解析索引。 */
export function buildResolveContext(files: FileParse[]): ResolveContext {
  const fileSymbolByName = new Map<string, Map<string, string>>();
  const classMethodId = new Map<string, string>();
  const importsByFile = new Map<string, Map<string, ExtractedImport>>();
  const globalByName = new Map<string, string[]>();
  const relPathSet = new Set(files.map((f) => f.relPath));

  for (const f of files) {
    const byName = new Map<string, string>();
    for (const s of f.symbols) {
      if (!s.id || !CALLABLE.has(s.kind)) continue;
      // 同名碰撞偏向 function/method（kind 排名小者）
      const prev = byName.get(s.name);
      if (!prev) byName.set(s.name, s.id);
      if (s.kind === "method" && s.enclosingClass)
        classMethodId.set(`${f.relPath}#${s.enclosingClass}#${s.name}`, s.id);
      const arr = globalByName.get(s.name) ?? [];
      arr.push(s.id);
      globalByName.set(s.name, arr);
    }
    fileSymbolByName.set(f.relPath, byName);
    const imp = new Map<string, ExtractedImport>();
    for (const i of f.imports) imp.set(i.localName, i);
    importsByFile.set(f.relPath, imp);
  }

  // 全局同名按 kind 排名排序（首个=最像可调用定义）
  const kindOf = new Map<string, number>();
  for (const f of files) for (const s of f.symbols) if (s.id) kindOf.set(s.id, KIND_RANK[s.kind] ?? 9);
  for (const [, ids] of globalByName) ids.sort((a, b) => (kindOf.get(a) ?? 9) - (kindOf.get(b) ?? 9));

  const resolveModule = (fromModule: string, callerRel: string) =>
    resolveModulePath(fromModule, callerRel, relPathSet);

  return { fileSymbolByName, classMethodId, importsByFile, globalByName, resolveModule };
}

export interface CalleeResolution {
  calleeId: string;
  confidence: number;
}

/** 解析单个调用点的被调符号。caller 提供 this 绑定所需的所属类。 */
export function resolveCallee(
  call: ExtractedCall,
  callerRel: string,
  caller: SymbolWithId | undefined,
  ctx: ResolveContext,
): CalleeResolution | null {
  const { calleeName: name, receiver } = call;

  // 1. this.foo() → 本类方法
  if (receiver === "this" && caller?.enclosingClass) {
    const id = ctx.classMethodId.get(`${callerRel}#${caller.enclosingClass}#${name}`);
    if (id) return { calleeId: id, confidence: 1 };
  }

  const imports = ctx.importsByFile.get(callerRel);

  if (receiver === "none") {
    // 2. 同文件
    const localId = ctx.fileSymbolByName.get(callerRel)?.get(name);
    if (localId) return { calleeId: localId, confidence: 1 };
    // 3. import 来源文件
    const imp = imports?.get(name);
    if (imp) {
      const ff = ctx.resolveModule(imp.fromModule, callerRel);
      if (ff) {
        const targetName = imp.importedName === "default" || imp.importedName === "*" ? name : imp.importedName;
        const id = ctx.fileSymbolByName.get(ff)?.get(targetName) ?? ctx.fileSymbolByName.get(ff)?.get(name);
        if (id) return { calleeId: id, confidence: 1 };
      }
    }
  } else if (receiver !== "this") {
    // 4. ns.foo()：receiver 是 namespace import 别名
    const imp = imports?.get(receiver);
    if (imp && imp.importedName === "*") {
      const ff = ctx.resolveModule(imp.fromModule, callerRel);
      const id = ff ? ctx.fileSymbolByName.get(ff)?.get(name) : undefined;
      if (id) return { calleeId: id, confidence: 1 };
    }
  }

  // 5/6. 全局兜底
  const ids = ctx.globalByName.get(name);
  if (ids?.length === 1) return { calleeId: ids[0], confidence: 0.5 };
  if (ids && ids.length > 1) return { calleeId: ids[0], confidence: 0.4 };
  return null;
}

/** 把相对引用解析成项目内真实文件 relPath（JS 用 ./../ 路径；Python 用 . 点式）。 */
export function resolveModulePath(
  fromModule: string,
  callerRel: string,
  relPathSet: Set<string>,
): string | undefined {
  if (!fromModule) return undefined;
  const dir = path.posix.dirname(callerRel);

  // Python 点式相对/绝对：".mod" / "..pkg.mod" / "pkg.mod"（无斜杠且含点或纯包名）
  const isPyDotted = !fromModule.includes("/") && (fromModule.startsWith(".") || /^[\w.]+$/.test(fromModule)) && callerRel.endsWith(".py");
  if (isPyDotted) {
    let dots = 0;
    while (fromModule[dots] === ".") dots++;
    let base = dots > 0 ? dir : "";
    for (let i = 1; i < dots; i++) base = path.posix.dirname(base);
    const rest = fromModule.slice(dots).split(".").filter(Boolean);
    const norm = [base, ...rest].filter(Boolean).join("/");
    return matchWithExt(norm, relPathSet, [".py"]);
  }

  // JS/TS 路径式相对
  if (fromModule.startsWith(".")) {
    const norm = path.posix.normalize(path.posix.join(dir, fromModule)).replace(/^\.\//, "");
    return matchWithExt(norm, relPathSet, JS_EXTS);
  }

  return undefined; // 第三方包：不在项目文件集内
}

/** 给无扩展名的基路径试各扩展名 + /index.*，返回第一个命中的真实 relPath。 */
function matchWithExt(base: string, relPathSet: Set<string>, exts: string[]): string | undefined {
  if (relPathSet.has(base)) return base;
  for (const e of exts) if (relPathSet.has(base + e)) return base + e;
  for (const e of exts) if (relPathSet.has(`${base}/index${e}`)) return `${base}/index${e}`;
  for (const e of exts) if (relPathSet.has(`${base}/__init__${e}`)) return `${base}/__init__${e}`;
  return undefined;
}
