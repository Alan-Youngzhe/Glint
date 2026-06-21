import { api } from "@/lib/api";
import { useWorkspace } from "@/stores/workspace";
import { useFocus } from "@/stores/focus";
import { useInsight } from "@/stores/insight";
import { useTrajectory } from "@/stores/trajectory";
import { provenanceLabel } from "@/types/contract";
import type {
  CardPayload,
  Dimension,
  Focus,
  InteractionEvent,
  UIAction,
} from "@/types/contract";

const TAB = { 2: "call", 3: "flow", 4: "arch" } as const;

/** 上报交互事件（直发 /api/events，带 projectId）。 */
export function reportEvent(ev: Omit<InteractionEvent, "ts">) {
  const projectId = useWorkspace.getState().projectId;
  if (!projectId) return;
  const payload = { ...ev, ts: new Date().toISOString() };
  void fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectId, events: [payload] }),
  }).catch(() => {});
}

/** ⌥1 就近浮卡（V3 §6.4）：新建 active 轨迹卡，selection 流式、其余直读。 */
export async function openFloatingCard(focus: Focus) {
  const projectId = useWorkspace.getState().projectId;
  if (!projectId) return;
  const card = useTrajectory.getState().activate(focus);

  if (focus.type === "selection" && api.understandStream) {
    for await (const ev of api.understandStream({ projectId, focus, dimension: 1 })) {
      if ("done" in ev) {
        useTrajectory.getState().fill(card.id, ev.done);
        useFocus.getState().setFocus(focus, provenanceLabel(ev.done.source));
      } else {
        useTrajectory.getState().appendDelta(card.id, ev.delta);
      }
    }
  } else {
    const res = (await api.understand({ projectId, focus, dimension: 1 })) as CardPayload;
    useTrajectory.getState().fill(card.id, res);
    useFocus.getState().setFocus(focus, provenanceLabel(res.source));
  }
}

/** 四维派发（V3 §6.2）：焦点不变，只切维度/Tab。 */
export async function dispatchDimension(focus: Focus, dim: Dimension) {
  const projectId = useWorkspace.getState().projectId;
  if (!projectId) return;
  reportEvent({
    action: `dim${dim}` as InteractionEvent["action"],
    focusType: focus.type,
    focusRef: focus.ref,
  });

  if (dim === 1) {
    await openFloatingCard(focus);
    return;
  }

  const tab = TAB[dim];
  useInsight.getState().openWith(tab);
  if (dim === 4) return; // ArchPanel 自取数据

  useInsight.getState().setLoading(true);
  try {
    const res = await api.understand({ projectId, focus, dimension: dim });
    if (res.kind === "callgraph") useInsight.getState().setCall(res);
    else if (res.kind === "execpath") useInsight.getState().setFlow(res);
  } catch {
    /* ignore */
  } finally {
    useInsight.getState().setLoading(false);
  }
}

/** UI 动作调度器（V3 §6.8）——Option 交互与 Agent 共用，保证一致。 */
export function runUIAction(a: UIAction) {
  switch (a.kind) {
    case "open_panel":
      if (a.panel === "call" || a.panel === "flow" || a.panel === "arch") {
        useInsight.getState().openWith(a.panel);
      }
      break;
    case "focus":
      useFocus.getState().setFocus(a.focus);
      break;
    case "highlight":
      useInsight.getState().setHighlight(a.panel, a.nodeIds);
      break;
    case "trigger_dimension":
      useFocus.getState().setFocus(a.focus);
      void dispatchDimension(a.focus, a.dimension);
      break;
  }
}
