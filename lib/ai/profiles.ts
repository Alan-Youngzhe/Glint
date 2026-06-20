import type { ProfileConfig, TaskProfile } from "./types";

/**
 * 任务画像 → 模型档位（Spec §7.2）。MVP 默认走 Anthropic（环境已知模型 id）。
 * 切厂商或模型只改这里；可后续提到配置表 / 环境变量。
 */
export const PROFILES: Record<TaskProfile, ProfileConfig> = {
  file_card: { provider: "anthropic", model: "claude-haiku-4-5-20251001", batch: true, cache: true },
  symbol_card: { provider: "anthropic", model: "claude-haiku-4-5-20251001", cache: true },
  module_arch: { provider: "anthropic", model: "claude-sonnet-4-6" },
  structure_gen: { provider: "anthropic", model: "claude-sonnet-4-6", temperature: 0 },
  edge_nl: { provider: "anthropic", model: "claude-haiku-4-5-20251001", cache: true },
  exec_path: { provider: "anthropic", model: "claude-sonnet-4-6", cache: true },
  explain: { provider: "anthropic", model: "claude-sonnet-4-6", temperature: 0.2 },
  tagging: { provider: "anthropic", model: "claude-sonnet-4-6" },
  embedding: { provider: "openai", model: "text-embedding-3-small" },
  generalize_note: { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
};
