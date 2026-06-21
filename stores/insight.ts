import { create } from "zustand";
import type { CallGraphPayload, ExecPathPayload } from "@/types/contract";

export type InsightTab = "call" | "flow" | "arch";

interface InsightState {
  tab: InsightTab;
  call: CallGraphPayload | null;
  flow: ExecPathPayload | null;
  loading: boolean;
  highlight: { tab: string; nodeIds: string[] } | null;
  setTab: (t: InsightTab) => void;
  openWith: (t: InsightTab) => void;
  setCall: (p: CallGraphPayload | null) => void;
  setFlow: (p: ExecPathPayload | null) => void;
  setLoading: (b: boolean) => void;
  setHighlight: (tab: string, nodeIds: string[]) => void;
}

/** 右侧 INSIGHT 单面板的三 Tab 状态（DS §15.5：三 Tab 合一，切 Tab 不切焦点）。 */
export const useInsight = create<InsightState>((set) => ({
  tab: "call",
  call: null,
  flow: null,
  loading: false,
  highlight: null,
  setTab: (tab) => set({ tab }),
  openWith: (tab) => set({ tab }),
  setCall: (call) => set({ call }),
  setFlow: (flow) => set({ flow }),
  setLoading: (loading) => set({ loading }),
  setHighlight: (tab, nodeIds) => set({ highlight: { tab, nodeIds } }),
}));
