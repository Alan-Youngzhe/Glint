"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { FolderUp, Loader2 } from "lucide-react";
import { useWorkspace } from "@/stores/workspace";

interface ProjectMeta {
  id: string;
  name: string;
  status: string;
}

export function ProjectBar() {
  const projectId = useWorkspace((s) => s.projectId);
  const setProject = useWorkspace((s) => s.setProject);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // webkitdirectory 不在 React 类型里，挂载后手动设属性。
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.setAttribute("webkitdirectory", "");
      el.setAttribute("directory", "");
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) setProjects(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !files.length) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      let root = "project";
      for (const f of Array.from(files)) {
        const rel = f.webkitRelativePath || f.name;
        if (!root || root === "project") root = rel.split("/")[0] || "project";
        zip.file(rel, f);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const form = new FormData();
      form.append("file", blob, "upload.zip");
      form.append("name", root);
      const res = await fetch("/api/projects", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        await refresh();
        if (data.project?.id) setProject(data.project.id);
      }
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={projectId ?? ""}
        onChange={(e) => e.target.value && setProject(e.target.value)}
        className="h-7 max-w-[180px] rounded-md border border-border bg-surface-elevated px-2 text-body-sm text-text outline-none focus-visible:border-accent"
      >
        <option value="" disabled>
          {projects.length ? "Select project…" : "No projects"}
        </option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-2 text-body-sm text-text-secondary transition-colors duration-2 ease-out hover:bg-surface-hover hover:text-text disabled:opacity-50"
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <FolderUp size={14} />
        )}
        Import
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={onPick}
        className="hidden"
      />
    </div>
  );
}
