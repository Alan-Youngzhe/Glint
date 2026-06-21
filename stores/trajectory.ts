import { create } from "zustand";
import type { CardPayload, Focus } from "@/types/contract";

export type CardStatus = "active" | "collapsed";

export interface TrajItem {
  id: string;
  focus: Focus;
  status: CardStatus;
  payload?: CardPayload;
  deltas: string;
  order: number;
}

interface TrajState {
  items: TrajItem[];
  activeId: string | null;
  activate: (focus: Focus) => TrajItem;
  appendDelta: (id: string, d: string) => void;
  fill: (id: string, p: CardPayload) => void;
  recall: (id: string) => void;
  close: (id: string) => void;
  clear: () => void;
}

let seq = 0;

/** 理解轨迹（V3 §6.6）：新触发收纳旧卡为 collapsed chip，底部 TrajectoryBar 渲染。 */
export const useTrajectory = create<TrajState>((set) => ({
  items: [],
  activeId: null,

  activate: (focus) => {
    const item: TrajItem = {
      id: `traj_${++seq}`,
      focus,
      status: "active",
      deltas: "",
      order: seq,
    };
    set((s) => ({
      items: [...s.items.map((i) => ({ ...i, status: "collapsed" as const })), item],
      activeId: item.id,
    }));
    return item;
  },

  appendDelta: (id, d) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, deltas: i.deltas + d } : i)),
    })),

  fill: (id, payload) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, payload } : i)),
    })),

  recall: (id) =>
    set((s) => ({
      items: s.items.map((i) => ({
        ...i,
        status: i.id === id ? "active" : "collapsed",
      })),
      activeId: id,
    })),

  close: (id) =>
    set((s) => {
      const items = s.items.filter((i) => i.id !== id);
      return { items, activeId: s.activeId === id ? null : s.activeId };
    }),

  clear: () => set({ items: [], activeId: null }),
}));
