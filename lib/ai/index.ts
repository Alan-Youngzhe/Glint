/**
 * AI 抽象层入口（Spec §7）。调用方按 TaskProfile 取档，不直接碰厂商 SDK。
 */
import { anthropicProvider } from "./anthropic";
import { openaiProvider } from "./openai";
import { PROFILES } from "./profiles";
import { recordUsage } from "./usage";
import type {
  LLMMessage,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  Provider,
  TaskProfile,
} from "./types";

const PROVIDERS: Record<Provider, LLMProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
};

export function getProvider(name: Provider): LLMProvider {
  return PROVIDERS[name];
}

/** 按任务画像跑一次补全，自动记账。 */
export async function runTask(
  profile: TaskProfile,
  messages: LLMMessage[],
  overrides: Partial<LLMRequest> = {},
): Promise<LLMResponse> {
  const cfg = PROFILES[profile];
  const provider = getProvider(cfg.provider);
  const started = Date.now();
  const res = await provider.complete({
    messages,
    model: cfg.model,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
    ...overrides,
  });
  recordUsage({
    ...res.usage,
    provider: res.provider,
    model: res.model,
    profile,
    latencyMs: Date.now() - started,
  });
  return res;
}

export { PROFILES, recordUsage };
export { usageSummary } from "./usage";
export type {
  LLMMessage,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  Provider,
  TaskProfile,
} from "./types";
