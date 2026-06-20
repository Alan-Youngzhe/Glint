import { create } from "zustand";

/** 代码选区（M1 仅捕获存储，不派发——派发是三期）。 */
export interface CodeSelection {
  fromLine: number;
  toLine: number;
  text: string;
}

interface WorkspaceState {
  projectId: string | null;
  activeFilePath: string | null;
  selection: CodeSelection | null;
  setProject: (id: string) => void;
  setActiveFile: (path: string) => void;
  setSelection: (sel: CodeSelection | null) => void;
}

export const useWorkspace = create<WorkspaceState>((set) => ({
  projectId: null,
  activeFilePath: null,
  selection: null,
  setProject: (id) => set({ projectId: id, activeFilePath: null, selection: null }),
  setActiveFile: (path) => set({ activeFilePath: path, selection: null }),
  setSelection: (selection) => set({ selection }),
}));
