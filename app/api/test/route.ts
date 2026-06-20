import { NextRequest, NextResponse } from "next/server";
import { getProvider, recordUsage, usageSummary } from "@/lib/ai";
import type { Provider } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * M0 DoD ①：调用任一厂商 → 拿结果 → 记 token/成本。
 * 用法：GET /api/test?provider=anthropic&prompt=用一句话介绍你自己
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const provider = (sp.get("provider") ?? "anthropic") as Provider;
  const prompt = sp.get("prompt") ?? "用一句话说明你是谁。";
  const model = sp.get("model") ?? undefined;

  if (provider !== "anthropic" && provider !== "openai") {
    return NextResponse.json(
      { error: "provider 必须为 anthropic 或 openai" },
      { status: 400 },
    );
  }

  try {
    const started = Date.now();
    const res = await getProvider(provider).complete({
      messages: [{ role: "user", content: prompt }],
      model,
      maxTokens: 256,
    });
    recordUsage({
      ...res.usage,
      provider: res.provider,
      model: res.model,
      latencyMs: Date.now() - started,
    });

    return NextResponse.json({
      ok: true,
      provider: res.provider,
      model: res.model,
      text: res.text,
      usage: res.usage,
      sessionTotal: usageSummary(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
