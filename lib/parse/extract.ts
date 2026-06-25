import type { TSNode as Node, Grammar } from "./loader";

export type SymKind = "function" | "class" | "method" | "variable";

export interface ExtractedSymbol {
  name: string;
  kind: SymKind;
  startLine: number;
  endLine: number;
  startIndex: number;
  endIndex: number;
  signature?: string;
  enclosingClass?: string; // method 所属类（this 绑定用）
}

/** 调用点接收者：none=裸 foo()；this=本类方法；其他=obj.foo() 的 obj 文本。 */
export type CallReceiver = "none" | "this" | (string & {});

export interface ExtractedCall {
  calleeName: string;
  receiver: CallReceiver;
  line: number;
  index: number; // 字节偏移，用于定位调用所在的外层符号
}

/** 一条 import 绑定：localName 在本文件可见，来自 fromModule 的 importedName。 */
export interface ExtractedImport {
  localName: string; // 本文件引用名（有别名取别名）
  importedName: string; // 来源模块里的原名（namespace 取 "*"，default 取 "default"）
  fromModule: string; // 原始模块字符串（相对路径或包名）
  line: number;
}

export interface ExtractedChunk {
  symbol: string;
  kind: SymKind;
  startLine: number;
  endLine: number;
  fingerprint: string; // 结构指纹（节点类型序列哈希，变量名无关）
  normalized: string;
}

/** djb2 字符串哈希。 */
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** 前序遍历收集 node.type 序列（保留结构、忽略标识符文本），上限 600 节点。 */
function typeSeq(node: Node): string {
  const types: string[] = [];
  const walk = (n: Node) => {
    if (types.length > 600) return;
    types.push(n.type);
    n.namedChildren.forEach(walk);
  };
  walk(node);
  return types.join(",");
}

function firstLine(text: string): string {
  const line = text.split("\n", 1)[0].trim();
  return line.length > 160 ? line.slice(0, 160) : line;
}

function toSymbol(
  node: Node,
  name: string,
  kind: SymKind,
  enclosingClass?: string,
): ExtractedSymbol {
  return {
    name,
    kind,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    startIndex: node.startIndex,
    endIndex: node.endIndex,
    signature: firstLine(node.text),
    ...(enclosingClass ? { enclosingClass } : {}),
  };
}

/** 沿父链找最近的类节点，返回类名。 */
function enclosingClassName(node: Node, classType: string): string | undefined {
  let p = node.parent;
  while (p) {
    if (p.type === classType) return p.childForFieldName("name")?.text ?? undefined;
    p = p.parent;
  }
  return undefined;
}

const JS_FAMILY: Grammar[] = ["typescript", "tsx", "javascript"];
const JS_FN_VALUE = new Set([
  "arrow_function",
  "function",
  "function_expression",
]);

export function extractSymbols(root: Node, grammar: Grammar): ExtractedSymbol[] {
  const out: ExtractedSymbol[] = [];
  const push = (node: Node | null, name: string | undefined, kind: SymKind) => {
    if (node && name) out.push(toSymbol(node, name, kind));
  };

  if (JS_FAMILY.includes(grammar)) {
    root
      .descendantsOfType(["function_declaration", "generator_function_declaration"])
      .forEach((n) => push(n, n.childForFieldName("name")?.text, "function"));
    root
      .descendantsOfType("class_declaration")
      .forEach((n) => push(n, n.childForFieldName("name")?.text, "class"));
    root.descendantsOfType("method_definition").forEach((n) => {
      const name = n.childForFieldName("name")?.text;
      if (name) out.push(toSymbol(n, name, "method", enclosingClassName(n, "class_declaration")));
    });
    root.descendantsOfType("variable_declarator").forEach((n) => {
      const name = n.childForFieldName("name")?.text;
      const value = n.childForFieldName("value");
      const kind: SymKind =
        value && JS_FN_VALUE.has(value.type) ? "function" : "variable";
      push(n, name, kind);
    });
  } else if (grammar === "python") {
    root.descendantsOfType("function_definition").forEach((n) => {
      const name = n.childForFieldName("name")?.text;
      if (!name) return;
      const inClass = isInside(n, "class_definition");
      if (inClass) out.push(toSymbol(n, name, "method", enclosingClassName(n, "class_definition")));
      else out.push(toSymbol(n, name, "function"));
    });
    root
      .descendantsOfType("class_definition")
      .forEach((n) => push(n, n.childForFieldName("name")?.text, "class"));
    root.descendantsOfType("assignment").forEach((n) => {
      const left = n.childForFieldName("left");
      if (left?.type === "identifier") push(n, left.text, "variable");
    });
  }

  return out;
}

/** 把接收者节点归一成 none/this/标识符文本（复杂表达式→none）。 */
function receiverOf(objectNode: Node | null, selfWords: Set<string>): CallReceiver {
  if (!objectNode) return "none";
  if (objectNode.type === "this" || selfWords.has(objectNode.text)) return "this";
  if (objectNode.type === "identifier") return objectNode.text;
  return "none";
}

export function extractCalls(root: Node, grammar: Grammar): ExtractedCall[] {
  const out: ExtractedCall[] = [];

  if (JS_FAMILY.includes(grammar)) {
    const self = new Set(["this"]);
    root.descendantsOfType("call_expression").forEach((n) => {
      const fn = n.childForFieldName("function");
      let name: string | undefined;
      let receiver: CallReceiver = "none";
      if (fn?.type === "identifier") name = fn.text;
      else if (fn?.type === "member_expression") {
        name = fn.childForFieldName("property")?.text;
        receiver = receiverOf(fn.childForFieldName("object"), self);
      }
      if (name) out.push({ calleeName: name, receiver, line: n.startPosition.row + 1, index: n.startIndex });
    });
  } else if (grammar === "python") {
    const self = new Set(["self", "cls"]);
    root.descendantsOfType("call").forEach((n) => {
      const fn = n.childForFieldName("function");
      let name: string | undefined;
      let receiver: CallReceiver = "none";
      if (fn?.type === "identifier") name = fn.text;
      else if (fn?.type === "attribute") {
        name = fn.childForFieldName("attribute")?.text;
        receiver = receiverOf(fn.childForFieldName("object"), self);
      }
      if (name) out.push({ calleeName: name, receiver, line: n.startPosition.row + 1, index: n.startIndex });
    });
  }

  return out;
}

/** 抽取 import 绑定：localName → (fromModule 的 importedName)。供跨文件 import-aware 解析。 */
export function extractImports(root: Node, grammar: Grammar): ExtractedImport[] {
  const out: ExtractedImport[] = [];
  const moduleText = (s: string | undefined): string =>
    (s ?? "").replace(/^['"`]|['"`]$/g, "");

  if (JS_FAMILY.includes(grammar)) {
    root.descendantsOfType("import_statement").forEach((n) => {
      const from = moduleText(n.childForFieldName("source")?.text);
      const line = n.startPosition.row + 1;
      if (!from) return;
      const clause = n.namedChildren.find((c) => c.type === "import_clause");
      if (!clause) return;
      for (const c of clause.namedChildren) {
        if (c.type === "identifier") {
          // default import: import Foo from "..."
          out.push({ localName: c.text, importedName: "default", fromModule: from, line });
        } else if (c.type === "namespace_import") {
          const id = c.namedChildren.find((x) => x.type === "identifier");
          if (id) out.push({ localName: id.text, importedName: "*", fromModule: from, line });
        } else if (c.type === "named_imports") {
          c.descendantsOfType("import_specifier").forEach((spec) => {
            const orig = spec.childForFieldName("name")?.text;
            const alias = spec.childForFieldName("alias")?.text;
            if (orig) out.push({ localName: alias ?? orig, importedName: orig, fromModule: from, line });
          });
        }
      }
    });
  } else if (grammar === "python") {
    // from .mod import foo, bar as baz
    root.descendantsOfType("import_from_statement").forEach((n) => {
      const from = n.childForFieldName("module_name")?.text ?? "";
      const line = n.startPosition.row + 1;
      for (const c of n.namedChildren) {
        if (c.type === "dotted_name" && c !== n.childForFieldName("module_name")) {
          out.push({ localName: c.text, importedName: c.text, fromModule: from, line });
        } else if (c.type === "aliased_import") {
          const orig = c.childForFieldName("name")?.text;
          const alias = c.childForFieldName("alias")?.text;
          if (orig) out.push({ localName: alias ?? orig, importedName: orig, fromModule: from, line });
        }
      }
    });
  }

  return out;
}

/** 抽取函数/方法块 + 结构指纹（泛化检索 B 用）。 */
export function extractChunks(root: Node, grammar: Grammar): ExtractedChunk[] {
  const out: ExtractedChunk[] = [];
  const push = (node: Node, name: string | undefined, kind: SymKind) => {
    if (!node || !name) return;
    out.push({
      symbol: name,
      kind,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      fingerprint: hashStr(typeSeq(node)),
      normalized: node.text.slice(0, 300),
    });
  };

  if (JS_FAMILY.includes(grammar)) {
    root
      .descendantsOfType(["function_declaration", "generator_function_declaration"])
      .forEach((n) => push(n, n.childForFieldName("name")?.text, "function"));
    root
      .descendantsOfType("method_definition")
      .forEach((n) => push(n, n.childForFieldName("name")?.text, "method"));
  } else if (grammar === "python") {
    root.descendantsOfType("function_definition").forEach((n) => {
      const inClass = isInside(n, "class_definition");
      push(n, n.childForFieldName("name")?.text, inClass ? "method" : "function");
    });
  }
  return out;
}

function isInside(node: Node, ancestorType: string): boolean {
  let p = node.parent;
  while (p) {
    if (p.type === ancestorType) return true;
    p = p.parent;
  }
  return false;
}
