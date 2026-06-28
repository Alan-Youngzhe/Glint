"use client";

import { useEffect } from "react";
import { useFocus } from "@/stores/focus";
import { dispatchDimension } from "@/lib/uiactions";
import type { Dimension } from "@/types/contract";

const CODE_TO_DIM: Record<string, Dimension> = {
  Digit1: 1,
  Digit2: 2,
  Digit3: 3,
  Digit4: 4,
};

/** 全局 Option(Alt)+1/2/3/4 派发（V3 §6.2）。 */
export function GlobalKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const dim = CODE_TO_DIM[e.code];
      if (!dim) return;
      e.preventDefault();
      const focus = useFocus.getState().current;
      if (focus) void dispatchDimension(focus, dim);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
