"use client";

import { useEffect, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { bracketMatching } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import type { Extension } from "@codemirror/state";
import { api } from "@/lib/api";
import { useWorkspace } from "@/stores/workspace";
import { useFocus } from "@/stores/focus";
import { glintCodeTheme } from "./theme";
import { FocusBar } from "@/components/shell/FocusBar";
import type { Focus, FocusType } from "@/types/contract";

interface SymInfo {
  id: string;
  kind: string;
  startLine: number;
  endLine: number;
}

function langExtension(path: string): Extension[] {
  if (/\.py$/i.test(path)) return [python()];
  if (/\.(ts|tsx)$/i.test(path)) return [javascript({ typescript: true, jsx: /\.tsx$/i.test(path) })];
  if (/\.(js|jsx|mjs|cjs)$/i.test(path)) return [javascript({ jsx: /\.jsx$/i.test(path) })];
  return [];
}

function kindToFocus(kind: string): FocusType {
  if (kind === "class") return "class";
  if (kind === "variable") return "variable";
  return "function"; // function/method
}

export function CodePanel() {
  const projectId = useWorkspace((s) => s.projectId);
  const activeFilePath = useWorkspace((s) => s.activeFilePath);
  const setSelection = useWorkspace((s) => s.setSelection);
  const setFocus = useFocus((s) => s.setFocus);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const symbolsRef = useRef<SymInfo[]>([]);
  const [lang, setLang] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hostRef.current || !activeFilePath || !projectId) return;
    let alive = true;

    // 拉该文件符号（带 id），用于光标→焦点解析
    fetch(`/api/symbols?projectId=${projectId}&file=${encodeURIComponent(activeFilePath)}`)
      .then((r) => (r.ok ? r.json() : { symbols: [] }))
      .then((d) => {
        symbolsRef.current = d.symbols ?? [];
      })
      .catch(() => {});

    api
      .file(projectId, activeFilePath)
      .then((file) => {
        if (!alive || !hostRef.current) return;
        setLang(file.lang);
        setError(null);
        setFocus({ type: "file", ref: activeFilePath });

        viewRef.current?.destroy();

        const selectionListener = EditorView.updateListener.of((u) => {
          if (!u.selectionSet) return;
          const range = u.state.selection.main;
          const doc = u.state.doc;
          if (!range.empty) {
            const startLine = doc.lineAt(range.from).number;
            const endLine = doc.lineAt(range.to).number;
            setSelection({ fromLine: startLine, toLine: endLine, text: u.state.sliceDoc(range.from, range.to) });
            setFocus(
              {
                type: "selection",
                ref: activeFilePath,
                selection: { fileId: activeFilePath, startLine, startCol: 0, endLine, endCol: 0 },
              },
              "实时 · 调 AI 解释",
            );
          } else {
            setSelection(null);
            const line = doc.lineAt(range.head).number;
            const inner = symbolsRef.current
              .filter((s) => s.startLine <= line && line <= s.endLine)
              .sort((a, b) => a.startLine - b.startLine)
              .pop();
            const focus: Focus = inner
              ? { type: kindToFocus(inner.kind), ref: inner.id }
              : { type: "file", ref: activeFilePath };
            setFocus(focus);
          }
        });

        const state = EditorState.create({
          doc: file.content,
          extensions: [
            lineNumbers(),
            highlightActiveLine(),
            bracketMatching(),
            EditorState.readOnly.of(true),
            EditorView.lineWrapping,
            glintCodeTheme,
            ...langExtension(activeFilePath),
            selectionListener,
          ],
        });

        viewRef.current = new EditorView({ state, parent: hostRef.current });
      })
      .catch((e) => alive && setError(String(e)));

    return () => {
      alive = false;
    };
  }, [projectId, activeFilePath, setSelection, setFocus]);

  useEffect(() => () => viewRef.current?.destroy(), []);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="truncate text-body-sm text-text-secondary">
          {activeFilePath ?? "未选择文件"}
        </span>
        {lang && (
          <span className="font-pixel text-pixel-label uppercase text-text-tertiary">
            {lang}
          </span>
        )}
      </div>
      <FocusBar />
      <div className="relative min-h-0 flex-1">
        {error && (
          <p className="absolute inset-0 flex items-center justify-center text-caption text-danger">
            加载失败：{error}
          </p>
        )}
        {!activeFilePath && !error && (
          <p className="absolute inset-0 flex items-center justify-center text-caption text-text-tertiary">
            从左侧选择一个文件
          </p>
        )}
        <div ref={hostRef} className="h-full w-full overflow-auto" />
      </div>
    </div>
  );
}
