"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { TechItem, TechLiteracy } from "@/types/contract";
import { useWorkspace } from "@/stores/workspace";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<TechItem["kind"], string> = {
  language: "Languages",
  framework: "Frameworks",
  library: "Libraries",
  tool: "Tools",
  datastore: "Datastores",
};

const KIND_ORDER: TechItem["kind"][] = [
  "language",
  "framework",
  "library",
  "tool",
  "datastore",
];

export function TechStackPanel() {
  const projectId = useWorkspace((s) => s.projectId);
  const [items, setItems] = useState<TechItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [literacy, setLiteracy] = useState<TechLiteracy | null>(null);
  const [loadingLit, setLoadingLit] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setItems([]);
      return;
    }
    let alive = true;
    api.techstack(projectId).then((t) => alive && setItems(t)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [projectId]);

  function openItem(it: TechItem) {
    setSelected(it.slug);
    setLiteracy(null);
    setLoadingLit(true);
    api
      .tech(it.slug)
      .then(setLiteracy)
      .finally(() => setLoadingLit(false));
  }

  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    items: items.filter((i) => i.kind === kind),
  })).filter((g) => g.items.length);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-8 shrink-0 items-center px-3 font-pixel text-pixel-label uppercase tracking-wide text-text-tertiary">
        Tech stack
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
        {!projectId && (
          <p className="py-2 text-caption text-text-tertiary">Select a project first</p>
        )}
        {projectId && !items.length && (
          <p className="py-2 text-caption text-text-tertiary">No tech detected</p>
        )}

        {grouped.map((g) => (
          <div key={g.kind} className="mb-3">
            <div className="mb-1.5 text-caption text-text-tertiary">
              {KIND_LABEL[g.kind]}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((it) => (
                <button
                  key={`${it.kind}:${it.slug}`}
                  type="button"
                  onClick={() => openItem(it)}
                  className={cn(
                    "rounded-xs border px-2 py-1 text-body-sm transition-colors duration-1 ease-out",
                    selected === it.slug
                      ? "border-accent text-accent-text"
                      : "border-border bg-surface-elevated text-text-secondary hover:bg-surface-hover hover:text-text",
                  )}
                  title={it.version ?? undefined}
                >
                  {it.name}
                </button>
              ))}
            </div>
          </div>
        ))}

        {selected && (
          <div className="mt-2 rounded-md border border-border bg-surface-elevated p-3">
            <div className="mb-1 text-h4 font-semibold text-text">{selected}</div>
            {loadingLit && (
              <p className="text-caption text-text-tertiary">Loading…</p>
            )}
            {literacy && (
              <dl className="space-y-2">
                <Field label="What" value={literacy.what} />
                <Field label="Purpose" value={literacy.purpose} />
                <Field label="Ecosystem" value={literacy.ecosystemPosition} />
              </dl>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-caption text-accent-text">{label}</dt>
      <dd className="text-body-sm text-text-secondary">{value}</dd>
    </div>
  );
}
