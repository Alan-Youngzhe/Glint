import { create } from "zustand";
import type { Dimension, Focus } from "@/types/contract";

interface FocusState {
  current: Focus | null;
  provenance: string | null;
  dim: Dimension | null; // 当前维度（TopBar 键帽 + 维度切换条高亮）
  setFocus: (f: Focus, provenance?: string | null) => void;
  setDim: (d: Dimension) => void;
}

/** 当前焦点（FocusBar 显示，Option 派发用）。 */
export const useFocus = create<FocusState>((set) => ({
  current: null,
  provenance: null,
  dim: null,
  setFocus: (current, provenance = null) => set({ current, provenance }),
  setDim: (dim) => set({ dim }),
}));
