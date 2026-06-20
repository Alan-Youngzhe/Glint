/** 模型定价表（Spec 附录 B，2026-06，USD / 百万 token）。价格随厂商调整，以实际计量为准。 */
export interface ModelPrice {
  inPerMtok: number;
  outPerMtok: number;
}

export const PRICING: Record<string, ModelPrice> = {
  // Anthropic
  "claude-opus-4-8": { inPerMtok: 5.0, outPerMtok: 25.0 },
  "claude-sonnet-4-6": { inPerMtok: 3.0, outPerMtok: 15.0 },
  "claude-haiku-4-5-20251001": { inPerMtok: 1.0, outPerMtok: 5.0 },
  // OpenAI（模型 id 以厂商实际为准）
  "gpt-5.5": { inPerMtok: 5.0, outPerMtok: 30.0 },
  "gpt-5.4": { inPerMtok: 2.5, outPerMtok: 15.0 },
  "gpt-5.4-nano": { inPerMtok: 0.2, outPerMtok: 1.25 },
};

/** 按 token 用量估算成本（USD）。未知模型返回 0 并交由调用方记账标注。 */
export function estimateCostFor(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = PRICING[model];
  if (!p) return 0;
  return (
    (promptTokens / 1_000_000) * p.inPerMtok +
    (completionTokens / 1_000_000) * p.outPerMtok
  );
}
