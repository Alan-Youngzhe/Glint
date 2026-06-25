"use client";

import { useEffect, useRef, useState } from "react";
import type { ArchModule } from "@/types/contract";
import { archToDiagramGraph } from "@/lib/structure/from-modules";
import { compileDiagramGraph } from "@/lib/structure/compile-mermaid";
import { cn } from "@/lib/utils";

/**
 * gitdiagram 风格的架构图（Mermaid flowchart，分组 subgraph + 按角色上色 + data 圆柱）。
 * 数据来自确定性模块地图；点击节点打开本地文件。浅色图布对齐 gitdiagram 观感。
 */

let mermaidInited = false;
let renderSeq = 0;

export function ArchDiagram({
  modules,
  onOpen,
}: {
  modules: ArchModule[];
  onOpen: (path: string, startLine: number | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const [scale, setScale] = useState(1);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const host = hostRef.current;
    if (!host || modules.length === 0) return;

    (async () => {
      const mermaid = (await import("mermaid")).default;
      if (!mermaidInited) {
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "loose",
          flowchart: { curve: "basis", htmlLabels: true, padding: 12 },
          themeVariables: {
            background: "#ffffff",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            fontSize: "13px",
            lineColor: "#94a3b8",
            clusterBkg: "#f1f5f9",
            clusterBorder: "#cbd5e1",
            edgeLabelBackground: "#ffffff",
          },
        });
        mermaidInited = true;
      }

      const { mermaid: code, pathByMermaidId } = compileDiagramGraph(archToDiagramGraph(modules));
      try {
        const id = `glint-arch-${++renderSeq}`;
        const { svg } = await mermaid.render(id, code);
        if (!alive || !hostRef.current) return;
        hostRef.current.innerHTML = svg;
        setErr(null);

        // 适配宽度的初始缩放
        const el = hostRef.current.querySelector("svg");
        if (el) {
          el.removeAttribute("style");
          el.style.maxWidth = "none";
          el.style.height = "auto";
        }

        // 绑定节点点击 → 打开文件
        hostRef.current.querySelectorAll<SVGGElement>("g.node").forEach((g) => {
          const m = g.id.match(/(node_[a-z0-9_]+)/);
          const hit = m && pathByMermaidId.get(m[1]);
          if (!hit) return;
          g.style.cursor = "pointer";
          g.addEventListener("click", () => onOpenRef.current(hit.path, hit.startLine));
        });
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      alive = false;
    };
  }, [modules]);

  if (modules.length === 0)
    return <p className="mt-6 text-center text-caption text-text-tertiary">No modules detected yet</p>;

  return (
    <div className="relative">
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <ZoomBtn label="−" onClick={() => setScale((s) => Math.max(0.4, s - 0.2))} />
        <ZoomBtn label="Fit" onClick={() => setScale(1)} small />
        <ZoomBtn label="+" onClick={() => setScale((s) => Math.min(3, s + 0.2))} />
      </div>
      {err ? (
        <p className="p-3 text-caption text-danger">Diagram error: {err}</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-border bg-white p-3">
          <div
            ref={hostRef}
            className="origin-top-left transition-transform duration-1 ease-out [&_svg]:h-auto"
            style={{ transform: `scale(${scale})` }}
          />
        </div>
      )}
    </div>
  );
}

function ZoomBtn({ label, onClick, small }: { label: string; onClick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-6 items-center justify-center rounded border border-border bg-surface-elevated text-body-sm text-text-secondary hover:bg-surface-hover hover:text-text",
        small ? "px-2" : "w-6",
      )}
    >
      {label}
    </button>
  );
}
