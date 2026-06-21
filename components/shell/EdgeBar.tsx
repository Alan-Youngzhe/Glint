"use client";

import {
  Boxes,
  FolderTree,
  GitBranch,
  MessageSquare,
  Search,
  Settings,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** 最左竖向图标栏（DS §15.7）。当前为视觉骨架，点击高亮；面板联动后续接 store。 */
const ITEMS = [
  { key: "explorer", icon: FolderTree, label: "资源管理器" },
  { key: "search", icon: Search, label: "搜索" },
  { key: "calls", icon: GitBranch, label: "调用" },
  { key: "tech", icon: Boxes, label: "技术栈" },
  { key: "agent", icon: MessageSquare, label: "Agent" },
  { key: "growth", icon: TrendingUp, label: "成长" },
];

export function EdgeBar({
  active = "explorer",
  onSelect,
}: {
  active?: string;
  onSelect?: (key: string) => void;
}) {
  return (
    <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-border bg-bg-subtle py-2">
      {ITEMS.map((it) => {
        const Icon = it.icon;
        const on = active === it.key;
        return (
          <button
            key={it.key}
            type="button"
            title={it.label}
            aria-label={it.label}
            onClick={() => onSelect?.(it.key)}
            className={cn(
              "relative flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-1 ease-out",
              on
                ? "text-text"
                : "text-text-tertiary hover:bg-surface-hover hover:text-text-secondary",
            )}
          >
            {on && (
              <span className="absolute left-0 top-1.5 h-6 w-0.5 rounded-full bg-accent" />
            )}
            <Icon size={18} strokeWidth={1.6} />
          </button>
        );
      })}
      <button
        type="button"
        title="设置"
        aria-label="设置"
        className="mt-auto flex h-9 w-9 items-center justify-center rounded-md text-text-tertiary transition-colors duration-1 ease-out hover:bg-surface-hover hover:text-text-secondary"
      >
        <Settings size={18} strokeWidth={1.6} />
      </button>
    </div>
  );
}
