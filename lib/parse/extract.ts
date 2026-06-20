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
}

export interface ExtractedCall {
  calleeName: string;
  line: number;
  index: number; // 字节偏移，用于定位调用所在的外层符号
}

function firstLine(text: string): string {
  const line = text.split("\n", 1)[0].trim();
  return line.length > 160 ? line.slice(0, 160) : line;
}

function toSymbol(node: Node, name: string, kind: SymKind): ExtractedSymbol {
  return {
    name,
    kind,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    startIndex: node.startIndex,
    endIndex: node.endIndex,
    signature: firstLine(node.text),
  };
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
    root
      .descendantsOfType("method_definition")
      .forEach((n) => push(n, n.childForFieldName("name")?.text, "method"));
    root.descendantsOfType("variable_declarator").forEach((n) => {
      const name = n.childForFieldName("name")?.text;
      const value = n.childForFieldName("value");
      const kind: SymKind =
        value && JS_FN_VALUE.has(value.type) ? "function" : "variable";
      push(n, name, kind);
    });
  } else if (grammar === "python") {
    root.descendantsOfType("function_definition").forEach((n) => {
      const inClass = isInside(n, "class_definition");
      push(n, n.childForFieldName("name")?.text, inClass ? "method" : "function");
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

export function extractCalls(root: Node, grammar: Grammar): ExtractedCall[] {
  const out: ExtractedCall[] = [];

  if (JS_FAMILY.includes(grammar)) {
    root.descendantsOfType("call_expression").forEach((n) => {
      const fn = n.childForFieldName("function");
      let name: string | undefined;
      if (fn?.type === "identifier") name = fn.text;
      else if (fn?.type === "member_expression")
        name = fn.childForFieldName("property")?.text;
      if (name) out.push({ calleeName: name, line: n.startPosition.row + 1, index: n.startIndex });
    });
  } else if (grammar === "python") {
    root.descendantsOfType("call").forEach((n) => {
      const fn = n.childForFieldName("function");
      let name: string | undefined;
      if (fn?.type === "identifier") name = fn.text;
      else if (fn?.type === "attribute") name = fn.childForFieldName("attribute")?.text;
      if (name) out.push({ calleeName: name, line: n.startPosition.row + 1, index: n.startIndex });
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
