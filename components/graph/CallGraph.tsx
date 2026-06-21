"use client";

import "reactflow/dist/style.css";
import { useMemo } from "react";
import ReactFlow, {
  Background,
  Handle,
  Position,
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

export function CallGraph({ payload }: { payload: CallGraphPayload }) {
  const setFocus = useFocus((s) => s.setFocus);

  const { nodes, edges } = useMemo(() => {
    const laid = layoutDag(payload.nodes, payload.edges, "TB");
    const nodes: Node<NodeData>[] = laid.map((n) => ({
      id: n.id,
      type: "glint",
      position: { x: n.x, y: n.y },
      data: { label: n.label, kind: n.kind, isFocus: n.isFocus },
    }));
    const edges: Edge[] = payload.edges.map((e, i) => ({
      id: `e${i}`,
      source: e.from,
      target: e.to,
      label: e.nl,
      labelStyle: { fill: "var(--text-secondary)", fontSize: 11 },
      labelBgStyle: { fill: "var(--surface)", fillOpacity: 0.85 },
      style: { stroke: "var(--border-strong)" },
      animated: false,
    }));
    return { nodes, edges };
  }, [payload]);

  function onNodeClick(_: unknown, node: Node) {
    const focus: Focus = { type: "function", ref: node.id };
    setFocus(focus);
    void dispatchDimension(focus, 2); // 点节点 = 钻取重排（V3 §6.7）
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
      minZoom={0.2}
    >
      <Background color="var(--border)" gap={20} />
    </ReactFlow>
  );
}
