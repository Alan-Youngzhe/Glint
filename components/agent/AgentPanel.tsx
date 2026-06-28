"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useAgent } from "@/stores/agent";
import { runUIAction } from "@/lib/uiactions";

/** Agent Bar 面板（V3 §7.4）：流式答 + 引用 chip + 建议(驱动界面)。 */
export function AgentPanel() {
  const messages = useAgent((s) => s.messages);
  const busy = useAgent((s) => s.busy);
  const send = useAgent((s) => s.send);
  const [input, setInput] = useState("");

  function submit() {
    const t = input.trim();
    if (!t) return;
    setInput("");
    void send(t);
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-8 shrink-0 items-center px-3 font-pixel text-pixel-label uppercase tracking-wide text-text-tertiary">
        Agent
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto px-3 py-2">
        {!messages.length && (
          <p className="text-caption text-text-tertiary">
            Ask me anything about this project — I read the structure, modules and tech stack to answer, and can open the right panel for you.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "text-text" : "text-text-secondary"}>
            <div className="mb-0.5 font-pixel text-pixel-label uppercase text-text-tertiary">
              {m.role === "user" ? "You" : "Glint"}
            </div>
            <p className="whitespace-pre-wrap text-body-sm">
              {m.content}
              {m.streaming && <span className="text-text-tertiary"> ▋</span>}
            </p>
            {!!m.citations.length && (
              <div className="mt-1 flex flex-wrap gap-1">
                {m.citations.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => runUIAction({ kind: "focus", focus: { type: "module", ref: c.ref } })}
                    className="rounded-xs border border-border px-1.5 py-0.5 text-pixel-label text-text-tertiary hover:border-accent hover:text-accent-text"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            {!!m.suggestions.length && (
              <div className="mt-1.5 flex flex-col items-start gap-1">
                {m.suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => s.action && runUIAction(s.action)}
                    className="rounded-md border border-border bg-surface-elevated px-2 py-1 text-caption text-text-secondary transition-colors duration-1 ease-out hover:bg-surface-hover hover:text-text"
                  >
                    {s.text} →
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Ask anything…"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-body-sm text-text outline-none placeholder:text-text-tertiary focus-visible:border-accent"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-elevated text-text-secondary hover:bg-surface-hover hover:text-text disabled:opacity-50"
          aria-label="Send"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
