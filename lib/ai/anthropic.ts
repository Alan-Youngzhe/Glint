import Anthropic from "@anthropic-ai/sdk";
import { estimateCostFor } from "./pricing";
import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
} from "./types";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 1024;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
    client = new Anthropic({ apiKey });
  }
  return client;
}

/** 把契约 messages 拆成 Anthropic 的 system + messages。 */
function split(req: LLMRequest) {
  const system = req.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const messages = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  return { system: system || undefined, messages };
}

export const anthropicProvider: LLMProvider = {
  name: "anthropic",

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const model = req.model ?? DEFAULT_MODEL;
    const { system, messages } = split(req);
    const res = await getClient().messages.create({
      model,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: req.temperature,
      system,
      messages,
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const promptTokens = res.usage.input_tokens;
    const completionTokens = res.usage.output_tokens;
    return {
      text,
      json: req.responseFormat === "json" ? safeJson(text) : undefined,
      provider: "anthropic",
      model,
      usage: {
        promptTokens,
        completionTokens,
        costUsd: estimateCostFor(model, promptTokens, completionTokens),
      },
    };
  },

  async *stream(req: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const model = req.model ?? DEFAULT_MODEL;
    const { system, messages } = split(req);
    const stream = await getClient().messages.create({
      model,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: req.temperature,
      system,
      messages,
      stream: true,
    });
    let promptTokens = 0;
    let completionTokens = 0;
    for await (const event of stream) {
      if (event.type === "message_start") {
        promptTokens = event.message.usage.input_tokens;
      } else if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield { delta: event.delta.text, done: false };
      } else if (event.type === "message_delta") {
        completionTokens = event.usage.output_tokens;
      }
    }
    yield {
      delta: "",
      done: true,
      usage: {
        promptTokens,
        completionTokens,
        costUsd: estimateCostFor(model, promptTokens, completionTokens),
      },
    };
  },

  async embed(): Promise<number[][]> {
    throw new Error("Anthropic has no embedding; use the openai provider");
  },

  estimateCost(u, model) {
    return estimateCostFor(model, u.promptTokens, u.completionTokens);
  },
};

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
