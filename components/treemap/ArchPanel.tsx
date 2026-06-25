"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ArchitecturePayload, ArchModule, ArchRole } from "@/types/contract";
import { useWorkspace } from "@/stores/workspace";
import { useFocus } from "@/stores/focus";
import { cn } from "@/lib/utils";

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

  if (!projectId) return <Shell hint="Select a project first" />;
  if (!data) return <Shell hint="Loading…" />;

  const modules = data.modules ?? [];
  const maxLoc = Math.max(1, ...modules.map((m) => m.loc));
  const tiers = TIERS.map((t) => ({
    ...t,
    items: modules.filter((m) => m.role === t.role),
  })).filter((t) => t.items.length > 0);

  function open(m: ArchModule) {
    if (m.topFile) setActiveFile(m.topFile);
    setFocus({ type: "file", ref: m.topFile || m.pathScope });
  }

  const hasSummary = data.overview.summary && data.overview.summary !== "(not analyzed yet)";

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="shrink-0 px-3 pt-2">
        <div className="text-h4 font-semibold text-text">Architecture · Project map</div>
        <div className="text-caption text-text-tertiary">
          The major parts, what each does, and how they connect
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
        {/* 一句话：这个系统是什么 */}
        {hasSummary && (
          <p className="mt-2 rounded-md border border-border bg-surface-elevated p-2.5 text-body-sm leading-relaxed text-text-secondary">
            {data.overview.summary}
          </p>
        )}

        {/* 技术栈图例 */}
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

        {/* 分层：每层一组模块卡 */}
        {modules.length === 0 ? (
          <p className="mt-6 text-center text-caption text-text-tertiary">
            No modules detected yet
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {tiers.map((t) => (
              <section key={t.role}>
                <div className="mb-1.5 flex items-baseline gap-2">
                  <span className="font-pixel text-pixel-label uppercase text-accent-text">
                    {t.label}
                  </span>
                  <span className="truncate text-caption text-text-tertiary">{t.blurb}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {t.items.map((m) => (
                    <ModuleCard
                      key={m.name}
                      module={m}
                      widthPct={Math.max(0.08, m.loc / maxLoc)}
                      onClick={() => open(m)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ModuleCard({
  module,
  widthPct,
  onClick,
}: {
  module: ArchModule;
  widthPct: number;
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
      </div>
      {/* 体量条：相对最大模块的 LOC */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-bg-subtle">
        <div className="h-full rounded-full bg-accent/70" style={{ width: `${widthPct * 100}%` }} />
      </div>
      <div className="flex items-center justify-between text-caption text-text-tertiary">
        <span>{module.fileCount} file{module.fileCount === 1 ? "" : "s"}</span>
        <span>{module.loc} LOC</span>
      </div>
      {/* 谁用谁：这个模块依赖的其他模块 */}
      {module.uses.length > 0 && (
        <div className="truncate text-caption text-text-tertiary">
          → uses {module.uses.slice(0, 3).join(", ")}
          {module.uses.length > 3 ? ` +${module.uses.length - 3}` : ""}
        </div>
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
