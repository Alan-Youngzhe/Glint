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
import { glintCodeTheme } from "./theme";

function langExtension(path: string): Extension[] {
  if (/\.py$/i.test(path)) return [python()];
  if (/\.(ts|tsx)$/i.test(path)) return [javascript({ typescript: true, jsx: /\.tsx$/i.test(path) })];
  if (/\.(js|jsx|mjs|cjs)$/i.test(path)) return [javascript({ jsx: /\.jsx$/i.test(path) })];
  return [];
}

export function CodePanel() {
  const projectId = useWorkspace((s) => s.projectId);
  const activeFilePath = useWorkspace((s) => s.activeFilePath);
  const setSelection = useWorkspace((s) => s.setSelection);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [lang, setLang] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hostRef.current || !activeFilePath || !projectId) return;
    let alive = true;

    api
      .file(projectId, activeFilePath)
      .then((file) => {
        if (!alive || !hostRef.current) return;
        setLang(file.lang);
        setError(null);

        viewRef.current?.destroy();

        const selectionListener = EditorView.updateListener.of((u) => {
          if (!u.selectionSet) return;
          const range = u.state.selection.main;
          if (range.empty) {
            setSelection(null);
            return;
          }
          const doc = u.state.doc;
          setSelection({
            fromLine: doc.lineAt(range.from).number,
            toLine: doc.lineAt(range.to).number,
            text: u.state.sliceDoc(range.from, range.to),
          });
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
  }, [projectId, activeFilePath, setSelection]);

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
