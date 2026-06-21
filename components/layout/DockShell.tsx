"use client";

import "dockview/dist/styles/dockview.css";
import {
  DockviewReact,
  themeDark,
  themeLight,
  type DockviewReadyEvent,
} from "dockview";
import type { Theme } from "./ThemeToggle";
import { FileTreePanel } from "@/components/tree/FileTreePanel";
import { CodePanel } from "@/components/code/CodePanel";
import { TechStackPanel } from "@/components/techstack/TechStackPanel";
import { InsightPanel } from "@/components/graph/InsightPanel";
import { AgentPanel } from "@/components/agent/AgentPanel";

const components = {
  filetree: () => <FileTreePanel />,
  code: () => <CodePanel />,
  insight: () => <InsightPanel />,
  techstack: () => <TechStackPanel />,
  agent: () => <AgentPanel />,
};

function onReady(event: DockviewReadyEvent) {
  const api = event.api;

  const explorer = api.addPanel({
    id: "explorer",
    component: "filetree",
    title: "资源管理器",
  });

  const code = api.addPanel({
    id: "code",
    component: "code",
    title: "代码",
    position: { referencePanel: explorer.id, direction: "right" },
  });

  const insight = api.addPanel({
    id: "insight",
    component: "insight",
    title: "INSIGHT",
    position: { referencePanel: code.id, direction: "right" },
  });

  const techstack = api.addPanel({
    id: "techstack",
    component: "techstack",
    title: "技术栈",
    position: { referencePanel: insight.id, direction: "below" },
  });

  api.addPanel({
    id: "agent",
    component: "agent",
    title: "Agent",
    position: { referencePanel: techstack.id, direction: "within" },
  });

  explorer.api.setSize({ width: 240 });
}

export function DockShell({ theme }: { theme: Theme }) {
  return (
    <div className="glint-dock h-full w-full">
      <DockviewReact
        components={components}
        onReady={onReady}
        theme={theme === "dark" ? themeDark : themeLight}
      />
    </div>
  );
}
