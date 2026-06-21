"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useWorkspace } from "@/stores/workspace";
import { useFocus } from "@/stores/focus";
import type { WeakPoint } from "@/types/contract";

const TREND: Record<WeakPoint["trend"], string> = { up: "↑", down: "↓", flat: "→" };

/** 成长分析弱项看板（V4 §6 / DS：中性 + 蓝阶）。 */
export function WeakBoard() {
  const projectId = useWorkspace((s) => s.projectId);
  const [items, setItems] = useState<WeakPoint[] | null>(null);

  useEffect(() => {
    if (!projectId) {
      setItems(null);
      return;
    }
    let alive = true;
    api.weakPoints(projectId).then((d) => alive && setItems(d)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [projectId]);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-8 shrink-0 items-center justify-between px-3">
        <span className="font-pixel text-pixel-label uppercase tracking-wide text-text-tertiary">
          成长 · 弱项
        </span>
        {projectId && (
          <button
            type="button"
            onClick={() => api.weakPoints(projectId).then(setItems).catch(() => {})}
            className="text-caption text-text-tertiary hover:text-text"
          >
            刷新
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
        {!projectId && <Hint text="先选择一个项目" />}
        {projectId && items && !items.length && (
          <Hint text="多按几次 ⌥1–⌥4 探索后，这里会显示你反复琢磨的地方" />
        )}
        {items?.map((w) => (
          <button
            key={w.slug}
            type="button"
            onClick={() => useFocus.getState().setFocus({ type: "file", ref: w.slug })}
            className="mb-2 block w-full rounded-md border border-border bg-surface-elevated p-2 text-left transition-colors duration-1 ease-out hover:bg-surface-hover"
          >
            <div className="flex items-center justify-between">
              <span className="truncate text-body-sm text-text">{w.name}</span>
              <span className="shrink-0 text-caption text-text-tertiary">
                问 {w.askCount} 次 {TREND[w.trend]}
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-bg-subtle">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.round(w.mastery * 100)}%` }}
              />
            </div>
            <div className="mt-0.5 text-pixel-label uppercase text-text-tertiary">
              掌握度 {Math.round(w.mastery * 100)}%
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return <p className="px-1 py-2 text-caption text-text-tertiary">{text}</p>;
}
