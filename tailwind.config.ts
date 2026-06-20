import type { Config } from "tailwindcss";

/**
 * Glint Design System v0.1 → Tailwind 语义映射。
 * 颜色/圆角/阴影/字体/动效一律指向 styles/tokens.css 的 CSS 变量。
 * 组件只用语义类（bg-surface / text-text-secondary / border-border…），禁止裸 hex。
 */
const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "var(--bg)",
          subtle: "var(--bg-subtle)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          elevated: "var(--surface-elevated)",
          hover: "var(--surface-hover)",
        },
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        text: {
          DEFAULT: "var(--text)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
          disabled: "var(--text-disabled)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          pressed: "var(--accent-pressed)",
          fg: "var(--accent-fg)",
          text: "var(--accent-text)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        pixel: "var(--radius-pixel)",
      },
      boxShadow: {
        1: "var(--shadow-1)",
        2: "var(--shadow-2)",
        3: "var(--shadow-3)",
        "highlight-top": "var(--highlight-top)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
        pixel: "var(--font-pixel)",
      },
      fontSize: {
        // 字阶（§3.2）：[size, lineHeight] + 字重/字距交给组件
        display: ["32px", { lineHeight: "38px", letterSpacing: "-0.02em" }],
        h1: ["26px", { lineHeight: "32px", letterSpacing: "-0.018em" }],
        h2: ["21px", { lineHeight: "28px", letterSpacing: "-0.012em" }],
        h3: ["17px", { lineHeight: "24px", letterSpacing: "-0.008em" }],
        h4: ["15px", { lineHeight: "20px" }],
        "body-lg": ["15px", { lineHeight: "23px" }],
        body: ["14px", { lineHeight: "21px" }],
        "body-sm": ["13px", { lineHeight: "19px" }],
        label: ["13px", { lineHeight: "16px" }],
        caption: ["12px", { lineHeight: "16px" }],
        code: ["13px", { lineHeight: "20px" }],
        "pixel-label": ["11px", { lineHeight: "14px", letterSpacing: "0.04em" }],
      },
      transitionDuration: {
        1: "80ms",
        2: "120ms",
        3: "160ms",
        4: "240ms",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(.2,0,0,1)",
        "in-out": "cubic-bezier(.4,0,.2,1)",
      },
      ringColor: {
        accent: "var(--accent)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
