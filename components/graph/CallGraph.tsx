"use client";

import "reactflow/dist/style.css";
import { useEffect, useMemo, useRef } from "react";
import ReactFlow, {
  Background,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import type { CallGraphPayload, Focus } from "@/types/contract";
import { layoutDag, NODE_H, NODE_W } from "./layout";
import { useFocus } from "@/stores/focus";
import { dispatchDimension } from "@/lib/uiactions";
import { cn } from "@/lib/utils";

interface NodeData {
  label: string;
  kind: string;
  isFocus?: boolean;
}

/** 实心节点卡片（DS §9.12）：surface-elevated + 1px border + shadow-1；焦点电蓝描边。 */
function GlintNode({ data }: NodeProps<NodeData>) {
  return (
    <div
      className={cn(
        "flex flex-col justify-center rounded-md border bg-surface-elevated px-3 shadow-1",
        data.isFocus ? "border-accent" : "border-border",
      )}
      style={{ width: NODE_W, height: NODE_H }}
    >
      <Handle type="target" position={Position.Top} className="!bg-text-tertiary" />
      <div className="truncate text-body-sm text-text">{data.label}</div>
      <div className="font-pixel text-pixel-label uppercase text-text-tertiary">
        {data.kind}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-text-tertiary" />
    </div>
  );
}

const nodeTypes = { glint: GlintNode };

function CallGraphInner({ payload }: { payload: CallGraphPayload }) {
  const setFocus = useFocus((s) => s.setFocus);

  const { nodes, edges } = useMemo(() => {
    const laid = layoutDag(payload.nodes, payload.edges, "TB");
    const nodes: Node<NodeData>[] = laid.map((n) => ({
      id: n.id,
      type: "glint",
      position: { x: n.x, y: n.y },
      data: { label: n.label, kind: n.kind, isFocus: n.isFocus },
    }));
    const edges: Edge[] = payload.edges.map((e, i) => {
      const weak = e.confidence !== undefined && e.confidence < 0.5;
      return {
        id: `e${i}`,
        source: e.from,
        target: e.to,
        label: e.nl,
        labelStyle: { fill: "var(--text-secondary)", fontSize: 11 },
        labelBgStyle: { fill: "var(--surface)", fillOpacity: 0.85 },
        // 弱推断边（同名歧义）：虚线 + 降透明度，呼应"确定解析 vs 猜"
        style: weak
          ? { stroke: "var(--border-strong)", strokeDasharray: "4 3", opacity: 0.5 }
          : { stroke: "var(--border-strong)" },
        animated: false,
      };
    });
    return { nodes, edges };
  }, [payload]);

  const { fitView } = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);

  // 数据变化时 fit（DS §9.14）。
  useEffect(() => {
    const id = window.setTimeout(() => fitView({ padding: 0.2, duration: 200 }), 50);
    return () => clearTimeout(id);
  }, [payload, fitView]);

  // dock 面板尺寸延迟成形：容器每次 resize 都重新 fit-to-bounds（修复初次渲染时容器过小被 minZoom 钳住）。
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => fitView({ padding: 0.2, duration: 0 }));
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [fitView]);

  function onNodeClick(_: unknown, node: Node) {
    const focus: Focus = { type: "function", ref: node.id };
    setFocus(focus);
    void dispatchDimension(focus, 2); // node click = drill + re-center (V3 §6.7)
  }

  return (
    <div ref={wrapRef} className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={1.5}
      >
        <Background color="var(--border)" gap={20} />
      </ReactFlow>
    </div>
  );
}

export function CallGraph({ payload }: { payload: CallGraphPayload }) {
  return (
    <ReactFlowProvider>
      <CallGraphInner payload={payload} />
    </ReactFlowProvider>
  );
}
