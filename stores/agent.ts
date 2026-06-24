import { create } from "zustand";
import { api } from "@/lib/api";
import { useWorkspace } from "@/stores/workspace";
import { runUIAction, reportEvent } from "@/lib/uiactions";
import type { Citation, Suggestion } from "@/types/contract";

export interface AgentMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  suggestions: Suggestion[];
  streaming?: boolean;
}

interface AgentState {
  messages: AgentMsg[];
  busy: boolean;
  send: (text: string) => Promise<void>;
}

let mseq = 0;

export const useAgent = create<AgentState>((set, get) => ({
  messages: [],
  busy: false,

  send: async (text) => {
    const projectId = useWorkspace.getState().projectId;
    if (!projectId || !text.trim() || get().busy) return;

    const userMsg: AgentMsg = { id: `m${++mseq}`, role: "user", content: text, citations: [], suggestions: [] };
    const botId = `m${++mseq}`;
    set((s) => ({
      messages: [
        ...s.messages,
        userMsg,
        { id: botId, role: "assistant", content: "", citations: [], suggestions: [], streaming: true },
      ],
      busy: true,
    }));
    reportEvent({ action: "agent", focusType: "file", focusRef: text.slice(0, 40) });

    const patch = (fn: (m: AgentMsg) => AgentMsg) =>
      set((s) => ({ messages: s.messages.map((m) => (m.id === botId ? fn(m) : m)) }));

    try {
      for await (const ev of api.agent({ projectId, message: text })) {
        if (ev.type === "token") patch((m) => ({ ...m, content: m.content + ev.delta }));
        else if (ev.type === "citation") patch((m) => ({ ...m, citations: [...m.citations, ev.citation] }));
        else if (ev.type === "suggestion") patch((m) => ({ ...m, suggestions: ev.suggestions }));
        else if (ev.type === "action") runUIAction(ev.action);
        else if (ev.type === "done") patch((m) => ({ ...m, streaming: false }));
      }
    } catch {
      patch((m) => ({ ...m, content: m.content + "\n[connection lost]", streaming: false }));
    } finally {
      set({ busy: false });
    }
  },
}));
