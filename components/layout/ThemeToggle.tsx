"use client";

import { Moon, Sun } from "lucide-react";

export type Theme = "dark" | "light";

export function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: Theme;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === "dark" ? "切换到浅色" : "切换到暗色"}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-elevated text-text-secondary transition-colors duration-2 ease-out hover:bg-surface-hover hover:text-text"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
