"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ThemeToggle, type Theme } from "./ThemeToggle";
import { ProjectBar } from "@/components/shell/ProjectBar";
import { GlobalKeys } from "@/components/shell/GlobalKeys";
import { FloatingCard } from "@/components/card/FloatingCard";
import { TrajectoryBar } from "@/components/card/TrajectoryBar";

const DockShell = dynamic(
  () => import("./DockShell").then((m) => m.DockShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-body-sm text-text-tertiary">
        加载布局…
      </div>
    ),
  },
);

const DIMENSIONS: { key: string; label: string }[] = [
  { key: "⌥1", label: "为什么这么写" },
  { key: "⌥2", label: "调用关系" },
  { key: "⌥3", label: "执行路径" },
  { key: "⌥4", label: "架构" },
];

function Keycap({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-pixel border border-border-strong bg-surface-elevated px-1 font-pixel text-pixel-label uppercase text-text-secondary">
      {children}
    </span>
  );
}

export function Workbench() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as Theme) ?? "dark";
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("glint-theme", next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  }

  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <span className="font-pixel text-pixel-label uppercase tracking-wide text-accent-text">
            Glint
          </span>
          <ProjectBar />
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-3 md:flex">
            {DIMENSIONS.map((d) => (
              <span key={d.key} className="flex items-center gap-1.5">
                <Keycap>{d.key}</Keycap>
                <span className="text-caption text-text-tertiary">
                  {d.label}
                </span>
              </span>
            ))}
          </div>
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        <DockShell theme={theme} />
        <FloatingCard />
      </main>

      <TrajectoryBar />
      <GlobalKeys />
    </div>
  );
}
