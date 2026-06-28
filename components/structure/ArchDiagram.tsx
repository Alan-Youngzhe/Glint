"use client";

import { useEffect, useRef, useState } from "react";
import type { ArchModule } from "@/types/contract";
import type { DiagramGraph } from "@/lib/structure/schema";
import { archToDiagramGraph } from "@/lib/structure/from-modules";
import { compileDiagramGraph } from "@/lib/structure/compile-mermaid";
import { cn } from "@/lib/utils";

/**
 * gitdiagram 风格架构图（Mermaid 分组流程图）。
 * 优先用 LLM 生成的图（/diagram，有分组/描述/带关系名的边）；无 key 时降级到确定性模块图。
 * 点击节点打开本地文件。浅色图布对齐 gitdiagram 观感。
 */

let mermaidInited = false;
let renderSeq = 0;

type Source = "loading" | "llm" | "deterministic";

export function ArchDiagram({
  projectId,
  modules,
  onOpen,
}: {
  projectId: string;
  modules: ArchModule[];
  onOpen: (path: string, startLine: number | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const [graph, setGraph] = useState<DiagramGraph | null>(null);
  const [source, setSource] = useState<Source>("loading");
  const [scale, setScale] = useState(1);
  const [err, setErr] = useState<string | null>(null);

  // 缩放通过设 svg 实际宽度实现（布局=视觉，无幻影滚动）；高度按 viewBox 比例自适应
  function applyWidth(s: number) {
    const svg = hostRef.current?.querySelector("svg");
    const natural = svg?.viewBox?.baseVal?.width;
    if (svg && natural) {
      svg.style.width = `${natural * s}px`;
      svg.style.height = "auto";
      svg.style.maxWidth = "none";
    }
  }

  // 按容器宽度自适应：scale = 容器内宽 / 图自然宽（封顶 1x）
  function fitToContainer() {
    const svg = hostRef.current?.querySelector("svg");
    const box = scrollRef.current;
    const natural = svg?.viewBox?.baseVal?.width;
    if (!natural || !box) return;
    const avail = box.clientWidth - 24;
    const next = avail > 0 ? Math.min(1, Math.max(0.2, avail / natural)) : 1;
    setScale(next);
    applyWidth(next);
    box.scrollTo({ left: 0, top: 0 });
  }

  // 缩放按钮改变 scale 时同步 svg 宽度
  useEffect(() => {
    applyWidth(scale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  // 取 LLM 图；失败/无 key → 降级到确定性
  useEffect(() => {
    let alive = true;
    setSource("loading");
    const fallback = () => {
      if (!alive) return;
      setGraph(modules.length ? archToDiagramGraph(modules) : null);
      setSource("deterministic");
    };
    fetch(`/api/projects/${projectId}/diagram`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.graph) {
          setGraph(d.graph as DiagramGraph);
          setSource("llm");
        } else fallback();
      })
      .catch(fallback);
    return () => {
      alive = false;
    };
  }, [projectId, modules]);

  async function regenerate() {
    setSource("loading");
    try {
      const d = await fetch(`/api/projects/${projectId}/diagram?refresh=1`).then((r) => r.json());
      if (d?.graph) {
        setGraph(d.graph as DiagramGraph);
        setSource("llm");
      } else {
        setGraph(modules.length ? archToDiagramGraph(modules) : null);
        setSource("deterministic");
      }
    } catch {
      setGraph(modules.length ? archToDiagramGraph(modules) : null);
      setSource("deterministic");
    }
  }

  // 渲染 mermaid
  useEffect(() => {
    let alive = true;
    if (!graph || graph.nodes.length === 0) return;

    (async () => {
      const mermaid = (await import("mermaid")).default;
      if (!mermaidInited) {
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "loose",
          flowchart: { curve: "basis", htmlLabels: true, padding: 12, useMaxWidth: false },
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

      const { mermaid: code, pathByMermaidId } = compileDiagramGraph(graph);
      try {
        const id = `glint-arch-${++renderSeq}`;
        const { svg } = await mermaid.render(id, code);
        if (!alive || !hostRef.current) return;
        hostRef.current.innerHTML = svg;
        setErr(null);

        const el = hostRef.current.querySelector("svg");
        if (el) {
          el.style.maxWidth = "none";
          el.style.height = "auto";
        }

        hostRef.current.querySelectorAll<SVGGElement>("g.node").forEach((g) => {
          const m = g.id.match(/(node_[a-z0-9_]+)/);
          const hit = m && pathByMermaidId.get(m[1]);
          if (!hit) return;
          g.style.cursor = "pointer";
          g.addEventListener("click", () => onOpenRef.current(hit.path, hit.startLine));
        });

        requestAnimationFrame(() => fitToContainer()); // 渲染后按容器宽度自适应
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      alive = false;
    };
  }, [graph]);

  if (source === "loading")
    return <p className="mt-6 text-center text-caption text-text-tertiary">Generating diagram…</p>;
  if (!graph || graph.nodes.length === 0)
    return <p className="mt-6 text-center text-caption text-text-tertiary">No modules detected yet</p>;

  return (
    <div className="relative">
      <div className="absolute left-2 top-2 z-10 flex items-center gap-1.5">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-pixel text-pixel-label uppercase",
            source === "llm" ? "bg-accent text-accent-fg" : "border border-border text-text-tertiary",
          )}
          title={source === "llm" ? "Generated by AI" : "Deterministic — add an API key for a richer AI diagram"}
        >
          {source === "llm" ? "AI" : "Auto"}
        </span>
        <button
          type="button"
          onClick={regenerate}
          className="rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-caption text-text-secondary hover:bg-surface-hover hover:text-text"
        >
          Regenerate
        </button>
      </div>
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <ZoomBtn label="−" onClick={() => setScale((s) => Math.max(0.2, s - 0.2))} />
        <ZoomBtn label="Fit" onClick={fitToContainer} small />
        <ZoomBtn label="+" onClick={() => setScale((s) => Math.min(3, s + 0.2))} />
      </div>
      {err ? (
        <p className="p-3 text-caption text-danger">Diagram error: {err}</p>
      ) : (
        <div ref={scrollRef} className="overflow-auto rounded-lg border border-border bg-white p-3 pt-10">
          <div ref={hostRef} className="[&_svg]:h-auto" />
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
