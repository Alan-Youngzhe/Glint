"use client";

import "dockview/dist/styles/dockview.css";
import {
  DockviewReact,
  themeDark,
  themeLight,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from "dockview";
import type { Theme } from "./ThemeToggle";
import { FileTreePanel } from "@/components/tree/FileTreePanel";
import { CodePanel } from "@/components/code/CodePanel";
import { TechStackPanel } from "@/components/techstack/TechStackPanel";
import { ArchPanel } from "@/components/treemap/ArchPanel";

interface PanelParams {
  title: string;
  hint: string;
  keycap?: string;
}

/** 占位面板：M0 空壳，仅展示可停靠布局与令牌外观。 */
function PlaceholderPanel(props: IDockviewPanelProps<PanelParams>) {
  const { title, hint, keycap } = props.params;
  return (
    <div className="flex h-full flex-col gap-3 bg-surface p-4">
      <div className="flex items-center gap-2">
        {keycap && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pixel border border-border-strong bg-surface-elevated px-1 font-pixel text-pixel-label uppercase text-text-secondary">
            {keycap}
          </span>
        )}
        <h3 className="text-h4 font-semibold text-text">{title}</h3>
      </div>
      <p className="text-body-sm text-text-secondary">{hint}</p>
      <div className="mt-auto rounded-md border border-dashed border-border bg-bg-subtle p-3 text-caption text-text-tertiary">
        拖动标签可分屏 / 停靠 / 收起 —— 后续接入真实视图。
      </div>
    </div>
  );
}

const components = {
  placeholder: PlaceholderPanel,
  filetree: () => <FileTreePanel />,
  code: () => <CodePanel />,
  techstack: () => <TechStackPanel />,
  arch: () => <ArchPanel />,
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

  const arch = api.addPanel({
    id: "architecture",
    component: "arch",
    title: "架构",
    position: { referencePanel: code.id, direction: "right" },
  });

  api.addPanel({
    id: "techstack",
    component: "techstack",
    title: "技术栈",
    position: { referencePanel: arch.id, direction: "below" },
  });

  api.addPanel({
    id: "callgraph",
    component: "placeholder",
    title: "调用图",
    params: {
      title: "调用图",
      hint: "⌥2 调用关系（M3 接入，dagre 分层布局）。",
      keycap: "⌥2",
    },
    position: { referencePanel: code.id, direction: "below" },
  });

  // 初始按比例铺开
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
