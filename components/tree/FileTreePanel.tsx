"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-react";
import { api } from "@/lib/api";
import type { TreeNode } from "@/types/contract";
import { useWorkspace } from "@/stores/workspace";
import { cn } from "@/lib/utils";

const CODE_EXT = /\.(ts|tsx|js|jsx|py|go|rs|java|rb|c|cc|cpp|h|css|json)$/i;

function collectDirIds(node: TreeNode, acc: Set<string>): Set<string> {
  if (node.kind === "dir") {
    acc.add(node.id);
    node.children?.forEach((c) => collectDirIds(c, acc));
  }
  return acc;
}

function FileIcon({ name }: { name: string }) {
  const Icon = CODE_EXT.test(name) ? FileCode : FileText;
  return <Icon size={15} className="shrink-0 text-text-tertiary" />;
}

function TreeRow({
  node,
  depth,
  expanded,
  toggle,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
}) {
  const activeFilePath = useWorkspace((s) => s.activeFilePath);
  const setActiveFile = useWorkspace((s) => s.setActiveFile);
  const isDir = node.kind === "dir";
  const isOpen = expanded.has(node.id);
  const isActive = !isDir && activeFilePath === node.path;

  return (
    <>
      <button
        type="button"
        onClick={() => (isDir ? toggle(node.id) : setActiveFile(node.path))}
        className={cn(
          "group relative flex h-7 w-full items-center gap-1.5 pr-2 text-left text-body-sm transition-colors duration-1 ease-out",
          isActive
            ? "bg-surface-hover text-text"
            : "text-text-secondary hover:bg-surface-hover hover:text-text",
        )}
        style={{ paddingLeft: 8 + depth * 16 }}
        aria-expanded={isDir ? isOpen : undefined}
      >
        {isActive && (
          <span className="absolute left-0 top-0 h-full w-0.5 bg-accent" />
        )}
        {isDir ? (
          <>
            {isOpen ? (
              <ChevronDown size={14} className="shrink-0 text-text-tertiary" />
            ) : (
              <ChevronRight size={14} className="shrink-0 text-text-tertiary" />
            )}
            {isOpen ? (
              <FolderOpen size={15} className="shrink-0 text-accent-text" />
            ) : (
              <Folder size={15} className="shrink-0 text-text-tertiary" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            <FileIcon name={node.name} />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isDir &&
        isOpen &&
        node.children?.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            toggle={toggle}
          />
        ))}
    </>
  );
}

export function FileTreePanel() {
  const projectId = useWorkspace((s) => s.projectId);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setTree(null);
      setError(null);
      return;
    }
    let alive = true;
    api
      .tree(projectId)
      .then((t) => {
        if (!alive) return;
        setTree(t);
        setError(null);
        setExpanded(collectDirIds(t, new Set()));
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const toggle = useMemo(
    () => (id: string) =>
      setExpanded((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      }),
    [],
  );

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-8 shrink-0 items-center px-3 font-pixel text-pixel-label uppercase tracking-wide text-text-tertiary">
        Explorer
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {!projectId && (
          <p className="px-3 py-2 text-caption text-text-tertiary">
            Import or select a project above
          </p>
        )}
        {error && (
          <p className="px-3 py-2 text-caption text-danger">Failed: {error}</p>
        )}
        {projectId && !tree && !error && (
          <p className="px-3 py-2 text-caption text-text-tertiary">Loading…</p>
        )}
        {tree?.children?.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            depth={0}
            expanded={expanded}
            toggle={toggle}
          />
        ))}
      </div>
    </div>
  );
}
