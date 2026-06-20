"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, treemap } from "d3-hierarchy";
import { api } from "@/lib/api";
import type { ArchitecturePayload, TreemapNode } from "@/types/contract";
import { useWorkspace } from "@/stores/workspace";

function useSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export function ArchPanel() {
  const projectId = useWorkspace((s) => s.projectId);
  const [data, setData] = useState<ArchitecturePayload | null>(null);
  const [stack, setStack] = useState<TreemapNode[]>([]);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const { w, h } = useSize(wrapRef);

  useEffect(() => {
    if (!projectId) {
      setData(null);
      setStack([]);
      return;
    }
    let alive = true;
    api
      .architecture(projectId)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setStack([d.root]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [projectId]);

  const current = stack[stack.length - 1];

  const laid = useMemo(() => {
    if (!current || w < 10 || h < 10) return null;
    const root = hierarchy<TreemapNode>(current, (d) => d.children)
      .sum((d) => (d.children?.length ? 0 : Math.max(d.loc, 1)))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const layout = treemap<TreemapNode>()
      .size([w, h])
      .paddingTop(16)
      .paddingInner(2)
      .round(true);
    return layout(root);
  }, [current, w, h]);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-8 shrink-0 items-center gap-2 px-3">
        <span className="font-pixel text-pixel-label uppercase tracking-wide text-text-tertiary">
          架构鸟瞰
        </span>
        {/* 下钻面包屑 */}
        {stack.length > 1 && (
          <div className="flex items-center gap-1 overflow-hidden text-caption text-text-secondary">
            {stack.map((n, i) => (
              <span key={n.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-text-tertiary">/</span>}
                <button
                  type="button"
                  onClick={() => setStack(stack.slice(0, i + 1))}
                  className="truncate hover:text-accent-text"
                >
                  {n.name || "根"}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 概述 + 技术栈图例 */}
      {data && (
        <div className="shrink-0 border-b border-border px-3 pb-2">
          <p className="line-clamp-2 text-caption text-text-secondary">
            {data.overview.summary}
          </p>
          {data.techStack.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {data.techStack.slice(0, 8).map((t) => (
                <span
                  key={t}
                  className="rounded-xs border border-border px-1.5 py-0.5 text-pixel-label text-text-tertiary"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div ref={wrapRef} className="relative min-h-0 flex-1">
        {!projectId && (
          <p className="absolute inset-0 flex items-center justify-center text-caption text-text-tertiary">
            先选择一个项目
          </p>
        )}
        {laid && (
          <svg width={w} height={h} className="block">
            {laid
              .descendants()
              .filter((n) => n.depth > 0)
              .map((n) => {
                const isDir = !!n.data.children?.length;
                const width = n.x1 - n.x0;
                const height = n.y1 - n.y0;
                if (width < 1 || height < 1) return null;
                return (
                  <g key={n.data.id} transform={`translate(${n.x0},${n.y0})`}>
                    <rect
                      width={width}
                      height={height}
                      rx={3}
                      className={
                        isDir
                          ? "cursor-pointer fill-bg-subtle stroke-border"
                          : "fill-surface-elevated stroke-border"
                      }
                      strokeWidth={1}
                      onClick={
                        isDir ? () => setStack([...stack, n.data]) : undefined
                      }
                    >
                      <title>{`${n.data.name} · ${n.data.loc} LOC`}</title>
                    </rect>
                    {(isDir || (width > 44 && height > 16)) && (
                      <text
                        x={4}
                        y={11}
                        className="pointer-events-none fill-text-secondary"
                        style={{ fontSize: 10 }}
                      >
                        {n.data.name.length > width / 6
                          ? n.data.name.slice(0, Math.max(0, Math.floor(width / 6)))
                          : n.data.name}
                      </text>
                    )}
                  </g>
                );
              })}
          </svg>
        )}
      </div>
    </div>
  );
}
