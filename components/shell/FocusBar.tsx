"use client";

import { useFocus } from "@/stores/focus";
import { dispatchDimension } from "@/lib/uiactions";
import type { Dimension, Focus } from "@/types/contract";
import { cn } from "@/lib/utils";

const DIMS: { dim: Dimension; keycap: string; label: string }[] = [
  { dim: 1, keycap: "⌥1", label: "Why" },
  { dim: 2, keycap: "⌥2", label: "Who calls" },
  { dim: 3, keycap: "⌥3", label: "How it runs" },
  { dim: 4, keycap: "⌥4", label: "Where" },
];

function focusLabel(f: Focus): string {
  if (f.type === "selection" && f.selection) {
    return `Lines ${f.selection.startLine}–${f.selection.endLine}`;
  }
  return f.ref.split("/").pop()?.split("#").pop() ?? f.ref;
}

/** FOCUS 条（焦点 + 来源标签）+ 维度切换条（DS §15.1/§15.2/§15.3）。 */
export function FocusBar() {
  const current = useFocus((s) => s.current);
  const provenance = useFocus((s) => s.provenance);
  const dim = useFocus((s) => s.dim);

  return (
    <div className="shrink-0 border-b border-border bg-bg-subtle px-3 py-1.5">
      {/* FOCUS 行 */}
      <div className="flex h-5 items-center gap-2 overflow-hidden">
        <span className="shrink-0 font-pixel text-pixel-label uppercase text-text-tertiary">
          Focus
        </span>
        {current ? (
          <span className="truncate text-body-sm text-text">{focusLabel(current)}</span>
        ) : (
          <span className="text-caption text-text-tertiary">No selection</span>
        )}
        {provenance && (
          <span className="shrink-0 rounded-xs border border-border px-1.5 font-pixel text-pixel-label uppercase text-text-tertiary">
            {provenance}
          </span>
        )}
      </div>

      {/* 维度切换条 */}
      <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto">
        {DIMS.map((d) => {
          const on = dim === d.dim;
          return (
            <button
              key={d.dim}
              type="button"
              disabled={!current}
              onClick={() => current && dispatchDimension(current, d.dim)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-body-sm transition-colors duration-1 ease-out",
                on
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-border bg-surface-elevated text-text-secondary hover:bg-surface-hover hover:text-text",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
              title={`${d.keycap} ${d.label}`}
            >
              <span
                className={cn(
                  "inline-flex h-4 min-w-[18px] items-center justify-center rounded-pixel border px-1 font-pixel text-pixel-label uppercase",
                  on ? "border-accent-fg/40 text-accent-fg" : "border-border-strong text-text-tertiary",
                )}
              >
                {d.keycap}
              </span>
              {d.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
