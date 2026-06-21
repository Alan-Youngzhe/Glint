"use client";

import { GitBranch, AlertTriangle, Ban } from "lucide-react";
import { useWorkspace } from "@/stores/workspace";

const LANG: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  py: "Python",
  go: "Go",
  rs: "Rust",
  json: "JSON",
  md: "Markdown",
  css: "CSS",
};

/** 最底状态栏（DS §15.7）：分支 · 错误/警告 · 当前文件 · 语言 · 编码 · Glint。 */
export function StatusBar() {
  const file = useWorkspace((s) => s.activeFilePath);
  const ext = file?.split(".").pop()?.toLowerCase() ?? "";

  return (
    <div className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-bg-subtle px-3 text-caption text-text-tertiary">
      <span className="flex items-center gap-1">
        <GitBranch size={12} /> main
      </span>
      <span className="flex items-center gap-1">
        <Ban size={11} /> 0
      </span>
      <span className="flex items-center gap-1">
        <AlertTriangle size={11} /> 0
      </span>
      <div className="ml-auto flex items-center gap-3">
        {file && <span className="truncate max-w-[240px]">{file}</span>}
        {ext && LANG[ext] && <span>{LANG[ext]}</span>}
        <span>UTF-8</span>
        <span className="flex items-center gap-1 text-accent-text">▲ Glint</span>
      </div>
    </div>
  );
}
