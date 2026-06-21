"use client";

import { useFocus } from "@/stores/focus";
import { dispatchDimension } from "@/lib/uiactions";
import type { Dimension, Focus } from "@/types/contract";
import { cn } from "@/lib/utils";

const DIMS: { dim: Dimension; keycap: string; label: string }[] = [
  { dim: 1, keycap: "⌥1", label: "为什么" },
  { dim: 2, keycap: "⌥2", label: "谁调用" },
  { dim: 3, keycap: "⌥3", label: "怎么执行" },
  { dim: 4, keycap: "⌥4", label: "在哪" },
];

function focusLabel(f: Focus): string {
  if (f.type === "selection" && f.selection) {
    return `第 ${f.selection.startLine}–${f.selection.endLine} 行`;
  }
  return f.ref.split("/").pop() ?? f.ref;
}

/** FOCUS 条 + 维度切换条（DS §15.1/§15.2/§15.3）。 */
export function FocusBar() {
  const current = useFocus((s) => s.current);
  const provenance = useFocus((s) => s.provenance);

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-bg-subtle px-3">
      <span className="shrink-0 font-pixel text-pixel-label uppercase text-text-tertiary">
        Focus
      </span>
      <span className="min-w-0 max-w-[40%] shrink truncate text-body-sm text-text">
        {current ? focusLabel(current) : <span className="text-text-tertiary">未选中</span>}
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {DIMS.map((d) => (
          <button
            key={d.dim}
            type="button"
            disabled={!current}
            onClick={() => current && dispatchDimension(current, d.dim)}
            className={cn(
              "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-1 text-caption transition-colors duration-1 ease-out",
              "text-text-secondary hover:bg-surface-hover hover:text-text",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
            title={`${d.keycap} ${d.label}`}
          >
            <span className="inline-flex h-4 min-w-[18px] items-center justify-center rounded-pixel border border-border-strong bg-surface-elevated px-1 font-pixel text-pixel-label uppercase">
              {d.keycap}
            </span>
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}
