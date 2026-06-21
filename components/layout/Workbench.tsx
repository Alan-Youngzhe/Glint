"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ThemeToggle, type Theme } from "./ThemeToggle";
import { ProjectBar } from "@/components/shell/ProjectBar";
import { GlobalKeys } from "@/components/shell/GlobalKeys";
import { EdgeBar } from "@/components/shell/EdgeBar";
import { StatusBar } from "@/components/shell/StatusBar";
import { FloatingCard } from "@/components/card/FloatingCard";
import { TrajectoryBar } from "@/components/card/TrajectoryBar";
import { useFocus } from "@/stores/focus";
import { cn } from "@/lib/utils";

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

const MENUS = ["文件", "编辑", "视图", "运行"];

/** TopBar 右侧维度键帽指示（当前维度电蓝，DS §15.7）。 */
function DimKeycaps() {
  const dim = useFocus((s) => s.dim);
  return (
    <div className="hidden items-center gap-1 md:flex">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={cn(
            "inline-flex h-5 min-w-[22px] items-center justify-center rounded-pixel border px-1 font-pixel text-pixel-label uppercase",
            dim === n
              ? "border-accent bg-accent text-accent-fg"
              : "border-border-strong bg-surface-elevated text-text-tertiary",
          )}
        >
          ⌥{n}
        </span>
      ))}
    </div>
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
      {/* TopBar */}
      <header className="relative flex h-10 shrink-0 items-center border-b border-border px-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-pixel text-pixel-label uppercase tracking-wide text-accent-text">
            ▲ Glint
          </span>
          <nav className="hidden items-center gap-3 lg:flex">
            {MENUS.map((m) => (
              <span key={m} className="text-caption text-text-tertiary">
                {m}
              </span>
            ))}
          </nav>
        </div>

        {/* 居中：项目选择/导入 */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <ProjectBar />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-caption text-text-tertiary xl:inline">
            选中对象，按一个键看懂它
          </span>
          <DimKeycaps />
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </header>

      {/* 主体：EdgeBar + Dock + 浮卡 */}
      <div className="flex min-h-0 flex-1">
        <EdgeBar />
        <main className="relative min-h-0 flex-1">
          <DockShell theme={theme} />
          <FloatingCard />
        </main>
      </div>

      <TrajectoryBar />
      <StatusBar />
      <GlobalKeys />
    </div>
  );
}
