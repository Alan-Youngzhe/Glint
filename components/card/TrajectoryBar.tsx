"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useTrajectory } from "@/stores/trajectory";
import { reportEvent } from "@/lib/uiactions";
import { cn } from "@/lib/utils";
import type { Focus } from "@/types/contract";

function shortLabel(focus: Focus): string {
  if (focus.type === "selection" && focus.selection) {
    return `Lines ${focus.selection.startLine}–${focus.selection.endLine}`;
  }
  const tail = focus.ref.split("/").pop() ?? focus.ref;
  return tail.length > 22 ? tail.slice(0, 22) + "…" : tail;
}

/** 底部理解轨迹条（DS §15.6）：chip 面包屑、点击跳回、Clear/Esc。 */
export function TrajectoryBar() {
  const items = useTrajectory((s) => s.items);
  const activeId = useTrajectory((s) => s.activeId);
  const recall = useTrajectory((s) => s.recall);
  const close = useTrajectory((s) => s.close);
  const clear = useTrajectory((s) => s.clear);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clear]);

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-t border-border bg-bg-subtle px-3">
      <span className="shrink-0 font-pixel text-pixel-label uppercase tracking-wide text-text-tertiary">
        Trajectory
      </span>
      <span className="hidden shrink-0 text-caption text-text-tertiary lg:inline">
        Drill path · click to jump
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {!items.length && (
          <span className="text-caption text-text-tertiary">
            Press ⌥1 on a selection to leave a trail
          </span>
        )}
        {items.map((it, i) => (
          <span key={it.id} className="flex shrink-0 items-center gap-1">
            {i > 0 && <span className="text-text-tertiary">›</span>}
            <button
              type="button"
              onClick={() => {
                recall(it.id);
                reportEvent({ action: "recall", focusType: it.focus.type, focusRef: it.focus.ref });
              }}
              className={cn(
                "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-caption transition-colors duration-1 ease-out",
                it.id === activeId
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
              )}
            >
              <span className="font-pixel text-pixel-label uppercase">⌥1</span>
              {shortLabel(it.focus)}
              <X
                size={11}
                onClick={(e) => {
                  e.stopPropagation();
                  close(it.id);
                }}
                className="opacity-60 hover:opacity-100"
              />
            </button>
          </span>
        ))}
      </div>
      {items.length > 0 && (
        <button
          type="button"
          onClick={clear}
          className="shrink-0 text-caption text-text-tertiary hover:text-text"
        >
          Clear
        </button>
      )}
    </div>
  );
}
