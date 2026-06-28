"use client";

import { useInsight, type InsightTab } from "@/stores/insight";
import { dispatchDimension } from "@/lib/uiactions";
import type { CallGraphPayload, GraphView } from "@/types/contract";
import { CallGraph } from "./CallGraph";
import { ExecPath } from "./ExecPath";
import { ArchPanel } from "@/components/treemap/ArchPanel";
import { cn } from "@/lib/utils";

const TABS: { key: InsightTab; keycap: string; label: string }[] = [
  { key: "call", keycap: "⌥2", label: "Call graph" },
  { key: "flow", keycap: "⌥3", label: "Exec path" },
  { key: "arch", keycap: "⌥4", label: "Architecture" },
];

/** 右侧 INSIGHT 单面板 + 三 Tab（DS §15.5）。切 Tab 不切焦点。 */
export function InsightPanel() {
  const tab = useInsight((s) => s.tab);
  const call = useInsight((s) => s.call);
  const flow = useInsight((s) => s.flow);
  const loading = useInsight((s) => s.loading);
  const setTab = useInsight((s) => s.setTab);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-body-sm transition-colors duration-1 ease-out",
              tab === t.key
                ? "bg-surface-hover text-text"
                : "text-text-secondary hover:text-text",
            )}
          >
            <span
              className={cn(
                "inline-flex h-4 min-w-[18px] items-center justify-center rounded-pixel border px-1 font-pixel text-pixel-label uppercase",
                tab === t.key
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-border-strong bg-surface-elevated text-text-secondary",
              )}
            >
              {t.keycap}
            </span>
            {t.label}
          </button>
        ))}
        {loading && (
          <span className="ml-auto text-caption text-text-tertiary">Loading…</span>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        {tab === "call" &&
          (call && call.nodes.length ? (
            <div className="flex h-full flex-col">
              <GraphControls payload={call} />
              {call.impact && call.impact.functions > 0 && (
                <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-bg-subtle px-2 py-1 text-caption text-text-secondary">
                  <span className="font-pixel text-pixel-label uppercase text-warning">Impact</span>
                  changing this affects {call.impact.functions} function
                  {call.impact.functions === 1 ? "" : "s"} in {call.impact.files} file
                  {call.impact.files === 1 ? "" : "s"}
                </div>
              )}
              <div className="min-h-0 flex-1">
                <CallGraph payload={call} />
              </div>
            </div>
          ) : (
            <Empty hint="Select a function/file, press ⌥2 to see who calls what" />
          ))}
        {tab === "flow" &&
          (flow ? (
            <ExecPath payload={flow} />
          ) : (
            <Empty hint="Select a function, press ⌥3 to see the exec path" />
          ))}
        {tab === "arch" && <ArchPanel />}
      </div>
    </div>
  );
}

/** ⌥2 LOD 控件：函数级↔模块级折叠 + 深度 N 跳（DS §15.5）。 */
function GraphControls({ payload }: { payload: CallGraphPayload }) {
  const view = useInsight((s) => s.graphView);
  const setGraphView = useInsight((s) => s.setGraphView);

  function apply(next: GraphView) {
    setGraphView(next);
    void dispatchDimension(payload.focus, 2);
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-2 py-1">
      <span className="font-pixel text-pixel-label uppercase text-text-tertiary">View</span>
      <Seg active={view.level === "function"} onClick={() => apply({ ...view, level: "function" })}>
        Functions
      </Seg>
      <Seg active={view.level === "module"} onClick={() => apply({ ...view, level: "module" })}>
        Modules
      </Seg>
      <span className="ml-2 font-pixel text-pixel-label uppercase text-text-tertiary">Depth</span>
      {[1, 2, 3].map((d) => (
        <Seg key={d} active={view.depth === d} onClick={() => apply({ ...view, depth: d })}>
          {d}
        </Seg>
      ))}
    </div>
  );
}

function Seg({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-1.5 py-0.5 text-caption transition-colors duration-1 ease-out",
        active
          ? "bg-accent text-accent-fg"
          : "text-text-secondary hover:bg-surface-hover hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-caption text-text-tertiary">
      {hint}
    </p>
  );
}
