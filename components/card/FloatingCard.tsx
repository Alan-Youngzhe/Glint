"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTrajectory } from "@/stores/trajectory";
import { useWorkspace } from "@/stores/workspace";
import { dispatchDimension } from "@/lib/uiactions";
import { api } from "@/lib/api";
import { provenanceLabel, type Focus, type FocusType, type SimilarHit } from "@/types/contract";

const BADGE: Record<FocusType, string> = {
  selection: "SELECTION",
  file: "FILE",
  folder: "FOLDER",
  module: "MODULE",
  function: "FUNCTION",
  class: "CLASS",
  variable: "VARIABLE",
};

/** ⌥1 就近浮卡（DS §15.4）。MVP 固定在编辑区左下、轨迹条之上。 */
export function FloatingCard() {
  const items = useTrajectory((s) => s.items);
  const activeId = useTrajectory((s) => s.activeId);
  const close = useTrajectory((s) => s.close);
  const projectId = useWorkspace((s) => s.projectId);
  const [hits, setHits] = useState<SimilarHit[] | null>(null);
  const item = items.find((i) => i.id === activeId && i.status === "active");
  if (!item) return null;

  const { payload, focus, deltas } = item;
  const provenance = payload ? provenanceLabel(payload.source) : "实时 · 调 AI 解释";
  const canGeneralize = focus.type === "function" || focus.type === "class";

  async function findSimilar() {
    if (!projectId) return;
    const res = await api.search({ projectId, focus });
    setHits(res.hits);
  }

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-30 w-[360px] max-w-[calc(100%-24px)] rounded-md border border-border bg-surface-elevated shadow-3">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="rounded-pixel border border-border-strong bg-surface px-1 font-pixel text-pixel-label uppercase text-text-secondary">
          {BADGE[focus.type]}
        </span>
        <span className="font-pixel text-pixel-label uppercase text-text-tertiary">
          {provenance}
        </span>
        <button
          type="button"
          onClick={() => close(item.id)}
          className="ml-auto text-text-tertiary hover:text-text"
          aria-label="关闭"
        >
          <X size={14} />
        </button>
      </div>

      <div className="max-h-[40vh] overflow-auto px-3 py-2.5">
        <div className="mb-1 text-h4 font-semibold text-text">{payload?.title ?? "理解中…"}</div>

        {/* selection：三段 */}
        {payload?.explanation && (
          <div className="space-y-2">
            {payload.explanation.role && (
              <Section title="这段在做什么" body={payload.explanation.role} />
            )}
            {payload.explanation.positionInContext && (
              <Section title="在上下文中的位置" body={payload.explanation.positionInContext} />
            )}
            {!!payload.explanation.syntax?.length && (
              <div className="flex flex-wrap gap-1">
                {payload.explanation.syntax.map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>
            )}
          </div>
        )}

        {/* variable：引用 */}
        {payload?.variableRefs && (
          <div className="space-y-1 text-body-sm text-text-secondary">
            <div>定义于 {payload.variableRefs.definedAt}</div>
            <div>
              读 {payload.variableRefs.reads} · 写 {payload.variableRefs.writes} · 使用{" "}
              {payload.variableRefs.usedBy.length} 处
            </div>
            {payload.variableRefs.usedBy.slice(0, 6).map((u, i) => (
              <div key={i} className="text-caption text-text-tertiary">
                {u.at}
              </div>
            ))}
          </div>
        )}

        {/* file/module/function：单段 */}
        {!payload?.explanation && !payload?.variableRefs && payload?.summary && (
          <p className="whitespace-pre-wrap text-body-sm text-text-secondary">
            {payload.summary}
          </p>
        )}

        {/* 流式占位 */}
        {!payload && (
          <p className="whitespace-pre-wrap text-body-sm text-text-secondary">
            {deltas || "…"}
          </p>
        )}

        {/* 泛化：相似写法（B） */}
        {hits && (
          <div className="mt-2 border-t border-border pt-2">
            <div className="text-caption text-accent-text">
              相似写法 {hits.length} 处
            </div>
            {hits.length ? (
              hits.slice(0, 8).map((h, i) => (
                <div key={i} className="text-caption text-text-tertiary">
                  {h.at}（{h.note}）
                </div>
              ))
            ) : (
              <div className="text-caption text-text-tertiary">未发现结构相同的写法</div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border px-3 py-2">
        <Action onClick={() => dispatchDimension(focus as Focus, 2)}>⌥2 谁调用 →</Action>
        <Action onClick={() => dispatchDimension(focus as Focus, 4)}>⌥4 在哪 →</Action>
        {canGeneralize && <Action onClick={findSimilar}>相似写法 →</Action>}
      </div>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="text-caption text-accent-text">{title}</div>
      <div className="text-body-sm text-text-secondary">{body}</div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-xs border border-border px-1.5 py-0.5 text-pixel-label text-text-tertiary">
      {children}
    </span>
  );
}

function Action({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-border bg-surface px-2 py-1 text-caption text-text-secondary transition-colors duration-1 ease-out hover:bg-surface-hover hover:text-text"
    >
      {children}
    </button>
  );
}
