import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/** Code Surface 主题（DS §9.11）。颜色全部走令牌，随主题切换。 */
const glintEditorTheme = EditorView.theme({
  "&": {
    color: "var(--text)",
    backgroundColor: "var(--surface)",
    height: "100%",
    fontSize: "13px",
  },
  ".cm-content": {
    fontFamily: "var(--font-mono)",
    caretColor: "var(--accent)",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "20px",
  },
  ".cm-gutters": {
    backgroundColor: "var(--surface)",
    color: "var(--text-tertiary)",
    border: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px 0 12px",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--cm-active-line)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--text-secondary)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    {
      backgroundColor: "var(--cm-selection)",
    },
  ".cm-cursor": {
    borderLeftColor: "var(--accent)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--surface-hover)",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)",
  },
});

const glintHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: "var(--cm-keyword)" },
  { tag: [t.string, t.special(t.string)], color: "var(--cm-string)" },
  { tag: [t.number, t.bool, t.null], color: "var(--cm-number)" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--text-tertiary)", fontStyle: "italic" },
  { tag: [t.typeName, t.className, t.namespace], color: "var(--text)" },
  { tag: [t.function(t.variableName), t.definition(t.function(t.variableName))], color: "var(--text)" },
  { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: "var(--text-secondary)" },
  { tag: [t.propertyName, t.variableName, t.attributeName], color: "var(--text)" },
]);

export const glintCodeTheme = [glintEditorTheme, syntaxHighlighting(glintHighlight)];
