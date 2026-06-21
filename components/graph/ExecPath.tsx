"use client";

import type { ExecPathPayload } from "@/types/contract";

/** ⌥3 执行路径（V3 §6.5）：按步骤时序展开，标注近似。 */
export function ExecPath({ payload }: { payload: ExecPathPayload }) {
  return (
    <div className="h-full overflow-auto p-4">
      {payload.note && (
        <div className="mb-3 rounded-md border border-border bg-bg-subtle px-3 py-2 text-caption text-text-tertiary">
          {payload.note}
        </div>
      )}
      {!payload.steps.length && (
        <p className="text-caption text-text-tertiary">无可用执行路径。</p>
      )}
      <ol className="relative ml-3 border-l border-border">
        {payload.steps.map((s) => (
          <li key={s.order} className="relative mb-4 pl-5">
            <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-accent" />
            <div className="flex items-baseline gap-2">
              <span className="font-pixel text-pixel-label text-text-tertiary">
                {s.order}
              </span>
              <span className="text-body-sm font-medium text-text">{s.symbol}</span>
              <span className="text-caption text-text-tertiary">{s.at}</span>
            </div>
            <div className="text-caption text-text-secondary">{s.describe}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
