import { create } from "zustand";
import type { Focus } from "@/types/contract";

interface FocusState {
  current: Focus | null;
  provenance: string | null;
  setFocus: (f: Focus, provenance?: string | null) => void;
}

/** 当前焦点（FocusBar 显示，Option 派发用）。 */
export const useFocus = create<FocusState>((set) => ({
  current: null,
  provenance: null,
  setFocus: (current, provenance = null) => set({ current, provenance }),
}));
