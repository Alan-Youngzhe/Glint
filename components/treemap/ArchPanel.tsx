"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ArchitecturePayload, ArchModule, ArchRole, TreemapNode } from "@/types/contract";
import { useWorkspace } from "@/stores/workspace";
import { useFocus } from "@/stores/focus";
import { dottedAddress, nodeAtPath, shouldExpand } from "@/lib/pregen/expand-rules";
import { ArchDiagram } from "@/components/structure/ArchDiagram";
import { cn } from "@/lib/utils";

type ArchView = "diagram" | "layers";

/** 角色 → 人话层（产品视角能读懂，按"离用户多近"从上到下排）。 */
const TIERS: { role: ArchRole; label: string; blurb: string }[] = [
  { role: "interface", label: "Interface", blurb: "what the outside world touches — screens, pages, API endpoints" },
  { role: "logic", label: "Logic", blurb: "the core rules and decisions" },
  { role: "data", label: "Data", blurb: "stores and reads information" },
  { role: "shared", label: "Shared", blurb: "helpers and config reused across the app" },
  { role: "other", label: "Other", blurb: "tests, docs, scripts and the rest" },
];

export function ArchPanel() {
  const projectId = useWorkspace((s) => s.projectId);
  const setActiveFile = useWorkspace((s) => s.setActiveFile);
  const setFocus = useFocus((s) => s.setFocus);
  const [data, setData] = useState<ArchitecturePayload | null>(null);
  const [path, setPath] = useState<string[]>([]); // 下钻路径（各级 name）
  const [view, setView] = useState<ArchView>("diagram");

  useEffect(() => {
    setPath([]);
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

  if (!projectId) return <Shell hint="Select a project first" />;
  if (!data) return <Shell hint="Loading…" />;

  function openFile(relPath: string) {
    setActiveFile(relPath);
    setFocus({ type: "file", ref: relPath });
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="shrink-0 px-3 pt-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-h4 font-semibold text-text">Architecture · Project map</div>
            <div className="text-caption text-text-tertiary">
              The major parts, what each does, and how they connect
            </div>
          </div>
          {/* 视图切换：图 / 分层列表 */}
          <div className="flex shrink-0 rounded-md border border-border p-0.5">
            {(["diagram", "layers"] as ArchView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded px-2 py-0.5 text-caption capitalize transition-colors duration-1",
                  view === v ? "bg-accent text-accent-fg" : "text-text-secondary hover:text-text",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
        {view === "diagram" ? (
          <div className="mt-2">
            <ArchDiagram modules={data.modules} onOpen={(p) => openFile(p)} />
          </div>
        ) : path.length === 0 ? (
          <Overview data={data} onDrill={(name) => setPath([name])} onOpen={openFile} />
        ) : (
          <DrillView
            root={data.root}
            path={path}
            onNavigate={setPath}
            onDrill={(name) => setPath([...path, name])}
            onOpen={openFile}
          />
        )}
      </div>
    </div>
  );
}

/** 顶层概览：一句话概述 + 技术栈 + 按角色分层的模块卡。 */
function Overview({
  data,
  onDrill,
  onOpen,
}: {
  data: ArchitecturePayload;
  onDrill: (name: string) => void;
  onOpen: (relPath: string) => void;
}) {
  const modules = data.modules ?? [];
  const maxLoc = Math.max(1, ...modules.map((m) => m.loc));
  const tiers = TIERS.map((t) => ({ ...t, items: modules.filter((m) => m.role === t.role) })).filter(
    (t) => t.items.length > 0,
  );
  const hasSummary = data.overview.summary && data.overview.summary !== "(not analyzed yet)";

  // 模块能否下钻：其根子节点是有子项的目录
  const drillable = (m: ArchModule) => {
    const n = nodeAtPath(data.root, [m.name]);
    return !!n && shouldExpand(n);
  };

  return (
    <>
      {hasSummary && (
        <p className="mt-2 rounded-md border border-border bg-surface-elevated p-2.5 text-body-sm leading-relaxed text-text-secondary">
          {data.overview.summary}
        </p>
      )}

      {data.techStack.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {data.techStack.slice(0, 8).map((t) => (
            <span key={t} className="flex items-center gap-1 text-caption text-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-text" />
              {t}
            </span>
          ))}
        </div>
      )}

      {modules.length === 0 ? (
        <p className="mt-6 text-center text-caption text-text-tertiary">No modules detected yet</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {tiers.map((t) => (
            <section key={t.role}>
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className="font-pixel text-pixel-label uppercase text-accent-text">{t.label}</span>
                <span className="truncate text-caption text-text-tertiary">{t.blurb}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {t.items.map((m) => (
                  <ModuleCard
                    key={m.name}
                    module={m}
                    widthPct={Math.max(0.08, m.loc / maxLoc)}
                    canDrill={drillable(m)}
                    onClick={() => (drillable(m) ? onDrill(m.name) : m.topFile && onOpen(m.topFile))}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/** 下钻视图：面包屑 + 当前节点的子项（目录可再钻，文件点开），带 dotted 编号。 */
function DrillView({
  root,
  path,
  onNavigate,
  onDrill,
  onOpen,
}: {
  root: TreemapNode;
  path: string[];
  onNavigate: (path: string[]) => void;
  onDrill: (name: string) => void;
  onOpen: (relPath: string) => void;
}) {
  const node = nodeAtPath(root, path);
  const children = node?.children ?? [];
  const maxLoc = Math.max(1, ...children.map((c) => c.loc));
  const address = dottedAddress(root, path);

  return (
    <>
      {/* 面包屑 */}
      <div className="mt-2 flex flex-wrap items-center gap-1 text-caption text-text-tertiary">
        <button type="button" className="hover:text-text" onClick={() => onNavigate([])}>
          Map
        </button>
        {path.map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-text-tertiary">/</span>
            <button
              type="button"
              className={cn("hover:text-text", i === path.length - 1 && "text-text")}
              onClick={() => onNavigate(path.slice(0, i + 1))}
            >
              {seg}
            </button>
          </span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {children.map((c, i) => (
          <DrillCard
            key={c.id}
            node={c}
            dotted={address ? `${address}.${i + 1}` : `${i + 1}`}
            widthPct={Math.max(0.08, c.loc / maxLoc)}
            onClick={() => (shouldExpand(c) ? onDrill(c.name) : onOpen(c.id))}
          />
        ))}
      </div>
    </>
  );
}

function ModuleCard({
  module,
  widthPct,
  canDrill,
  onClick,
}: {
  module: ArchModule;
  widthPct: number;
  canDrill: boolean;
  onClick: () => void;
}) {
  const activeRef = useFocus((s) => s.current?.ref);
  const on = activeRef === module.topFile || activeRef === module.pathScope;
  const label = module.name === "(root)" ? "(root files)" : module.name;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} · ${module.fileCount} file(s) · ${module.loc} LOC`}
      className={cn(
        "flex flex-col gap-1.5 rounded-md border p-2 text-left transition-colors duration-1 ease-out",
        on ? "border-accent bg-surface-hover" : "border-border bg-surface-elevated hover:bg-surface-hover",
      )}
    >
      <div className="flex items-center gap-1.5">
        {module.isEntry && (
          <span className="shrink-0 text-caption text-accent-text" title="Entry point — where it starts">
            ▶
          </span>
        )}
        <span className="truncate text-body-sm font-medium text-text">{label}</span>
        {canDrill && <span className="ml-auto shrink-0 text-caption text-text-tertiary">›</span>}
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-bg-subtle">
        <div className="h-full rounded-full bg-accent/70" style={{ width: `${widthPct * 100}%` }} />
      </div>
      <div className="flex items-center justify-between text-caption text-text-tertiary">
        <span>{module.fileCount} file{module.fileCount === 1 ? "" : "s"}</span>
        <span>{module.loc} LOC</span>
      </div>
      {module.uses.length > 0 && (
        <div className="truncate text-caption text-text-tertiary">
          → uses {module.uses.slice(0, 3).join(", ")}
          {module.uses.length > 3 ? ` +${module.uses.length - 3}` : ""}
        </div>
      )}
    </button>
  );
}

function DrillCard({
  node,
  dotted,
  widthPct,
  onClick,
}: {
  node: TreemapNode;
  dotted: string;
  widthPct: number;
  onClick: () => void;
}) {
  const activeRef = useFocus((s) => s.current?.ref);
  const isDir = shouldExpand(node);
  const on = activeRef === node.id;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${node.id} · ${node.loc} LOC`}
      className={cn(
        "flex flex-col gap-1.5 rounded-md border p-2 text-left transition-colors duration-1 ease-out",
        on ? "border-accent bg-surface-hover" : "border-border bg-surface-elevated hover:bg-surface-hover",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 font-pixel text-pixel-label text-text-tertiary">{dotted}</span>
        <span className="shrink-0 text-caption text-text-tertiary">{isDir ? "▸" : "·"}</span>
        <span className="truncate text-body-sm font-medium text-text">{node.name}</span>
        {isDir && <span className="ml-auto shrink-0 text-caption text-text-tertiary">›</span>}
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-bg-subtle">
        <div className="h-full rounded-full bg-accent/70" style={{ width: `${widthPct * 100}%` }} />
      </div>
      <div className="flex items-center justify-between text-caption text-text-tertiary">
        <span>{isDir ? `${node.children?.length ?? 0} items` : "file"}</span>
        <span>{node.loc} LOC</span>
      </div>
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
