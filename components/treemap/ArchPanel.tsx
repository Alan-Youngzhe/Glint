"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ArchitecturePayload, TreemapNode } from "@/types/contract";
import { useWorkspace } from "@/stores/workspace";
import { useFocus } from "@/stores/focus";
import { cn } from "@/lib/utils";

/** 目录名 → 角色标签（确定性启发式，无 key 也可用；与设计稿 HTTP/业务/模型… 对齐）。 */
const DIR_ROLE: Record<string, string> = {
  app: "Entry",
  routes: "HTTP",
  route: "HTTP",
  api: "API",
  services: "Logic",
  service: "Logic",
  controllers: "Control",
  db: "Model",
  models: "Model",
  model: "Model",
  middleware: "Session",
  auth: "Auth",
  utils: "Utils",
  util: "Utils",
  lib: "Lib",
  helpers: "Utils",
  components: "UI",
  ui: "UI",
  store: "State",
  stores: "State",
  hooks: "Hooks",
  config: "Config",
};
function roleOf(name: string): string {
  return DIR_ROLE[name.toLowerCase()] ?? name;
}

/** 收集某节点下所有文件叶子。 */
function files(node: TreemapNode): TreemapNode[] {
  if (!node.children) return node.kind === "file" ? [node] : [];
  return node.children.flatMap(files);
}

/** 下钻到"模块层"：穿透单一子目录的包裹层（如 root→src），外层散文件归入 (根)。 */
function moduleLevel(root: TreemapNode): { level: TreemapNode; loose: TreemapNode[] } {
  let n = root;
  const loose: TreemapNode[] = [];
  while (n.children) {
    const dirs = n.children.filter((c) => c.kind !== "file");
    const fs = n.children.filter((c) => c.kind === "file");
    if (dirs.length === 1) {
      loose.push(...fs);
      n = dirs[0];
      continue;
    }
    break;
  }
  return { level: n, loose };
}

export function ArchPanel() {
  const projectId = useWorkspace((s) => s.projectId);
  const setFocus = useFocus((s) => s.setFocus);
  const [data, setData] = useState<ArchitecturePayload | null>(null);

  useEffect(() => {
    if (!projectId) {
      setData(null);
      return;
    }
    let alive = true;
    api.architecture(projectId).then((d) => alive && setData(d)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [projectId]);

  if (!projectId)
    return <Shell hint="Select a project first" />;
  if (!data) return <Shell hint="Loading…" />;

  const { level, loose } = moduleLevel(data.root);
  const dirCols = (level.children ?? []).filter((c) => c.kind !== "file");
  const looseFiles = [
    ...loose,
    ...(level.children ?? []).filter((c) => c.kind === "file"),
  ];
  const columns = [
    ...dirCols.map((d) => ({ name: d.name, role: roleOf(d.name), items: files(d) })),
    ...(looseFiles.length ? [{ name: "(root)", role: "", items: looseFiles }] : []),
  ];

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="shrink-0 px-3 pt-2">
        <div className="text-h4 font-semibold text-text">Architecture · Project map</div>
        <div className="text-caption text-text-tertiary">
          How it splits, how big each part is — click a block to drill in
        </div>
        {/* 技术栈图例 */}
        {data.techStack.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {data.techStack.slice(0, 8).map((t) => (
              <span key={t} className="flex items-center gap-1 text-caption text-text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-text" />
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 列：按顶层目录分块 */}
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="flex h-full min-h-[320px] gap-2">
          {columns.map((col) => {
            const colLoc = col.items.reduce((s, f) => s + Math.max(f.loc, 1), 0);
            return (
              <div key={col.name} className="flex min-w-[112px] flex-1 flex-col">
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="truncate text-body-sm text-text-secondary">{col.name}</span>
                  {col.role && (
                    <span className="shrink-0 font-pixel text-pixel-label uppercase text-text-tertiary">
                      {col.role}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  {col.items.map((f) => (
                    <Block
                      key={f.id}
                      node={f}
                      role={col.role}
                      grow={Math.max(f.loc, 1) / Math.max(colLoc, 1)}
                      onClick={() => setFocus({ type: "file", ref: f.id })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Block({
  node,
  role,
  grow,
  onClick,
}: {
  node: TreemapNode;
  role: string;
  grow: number;
  onClick: () => void;
}) {
  const activeRef = useFocus((s) => s.current?.ref);
  const on = activeRef === node.id;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${node.name} · ${node.loc} LOC`}
      style={{ flexGrow: grow }}
      className={cn(
        "flex min-h-[44px] flex-col justify-between rounded-md border p-2 text-left transition-colors duration-1 ease-out",
        on
          ? "border-accent bg-surface-hover"
          : "border-border bg-surface-elevated hover:bg-surface-hover",
      )}
    >
      <span className="truncate text-caption text-text">{node.name}</span>
      {role && (
        <span className="font-pixel text-pixel-label uppercase text-text-tertiary">{role}</span>
      )}
    </button>
  );
}

function Shell({ hint }: { hint: string }) {
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="shrink-0 px-3 pt-2 text-h4 font-semibold text-text">Architecture · Project map</div>
      <p className="flex flex-1 items-center justify-center text-caption text-text-tertiary">{hint}</p>
    </div>
  );
}
