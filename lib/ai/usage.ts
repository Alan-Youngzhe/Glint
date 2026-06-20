import type { LLMUsage, Provider, TaskProfile } from "./types";

export interface UsageRecord extends LLMUsage {
  provider: Provider;
  model: string;
  profile?: TaskProfile;
  latencyMs?: number;
  ts: string;
}

/**
 * 用量记账（Spec §7.5）。MVP 打到 console；后续接 query_logs 表。
 * 进程内累计便于在测试路由里返回会话级汇总。
 */
const records: UsageRecord[] = [];

export function recordUsage(r: Omit<UsageRecord, "ts">): UsageRecord {
  const rec: UsageRecord = { ...r, ts: new Date().toISOString() };
  records.push(rec);
  // eslint-disable-next-line no-console
  console.info(
    `[ai] ${rec.provider}/${rec.model}` +
      `${rec.profile ? ` (${rec.profile})` : ""} ` +
      `in=${rec.promptTokens} out=${rec.completionTokens} ` +
      `cost=$${rec.costUsd.toFixed(6)}` +
      `${rec.latencyMs != null ? ` ${rec.latencyMs}ms` : ""}`,
  );
  return rec;
}

export function usageSummary() {
  return records.reduce(
    (acc, r) => ({
      calls: acc.calls + 1,
      promptTokens: acc.promptTokens + r.promptTokens,
      completionTokens: acc.completionTokens + r.completionTokens,
      costUsd: acc.costUsd + r.costUsd,
    }),
    { calls: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 },
  );
}
