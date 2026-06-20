import { create } from "zustand";

/** 代码选区（M1 仅捕获存储，不派发——派发是三期）。 */
export interface CodeSelection {
  fromLine: number;
  toLine: number;
  text: string;
}

interface WorkspaceState {
  /** MVP 单项目，mock 阶段固定 "demo"。 */
  projectId: string;
  activeFilePath: string | null;
  selection: CodeSelection | null;
  setActiveFile: (path: string) => void;
  setSelection: (sel: CodeSelection | null) => void;
}

export const useWorkspace = create<WorkspaceState>((set) => ({
  projectId: "demo",
  activeFilePath: "auth/guard.ts",
  selection: null,
  setActiveFile: (path) => set({ activeFilePath: path, selection: null }),
  setSelection: (selection) => set({ selection }),
}));
