import OpenAI from "openai";
import { estimateCostFor } from "./pricing";
import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
} from "./types";

const DEFAULT_MODEL = "gpt-5.4-nano";
const DEFAULT_EMBED_MODEL = "text-embedding-3-small";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY 未配置");
    client = new OpenAI({ apiKey });
  }
  return client;
}

export const openaiProvider: LLMProvider = {
  name: "openai",

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const model = req.model ?? DEFAULT_MODEL;
    const res = await getClient().chat.completions.create({
      model,
      messages: req.messages,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      response_format:
        req.responseFormat === "json" ? { type: "json_object" } : undefined,
    });
    const text = res.choices[0]?.message?.content ?? "";
    const promptTokens = res.usage?.prompt_tokens ?? 0;
    const completionTokens = res.usage?.completion_tokens ?? 0;
    return {
      text,
      json: req.responseFormat === "json" ? safeJson(text) : undefined,
      provider: "openai",
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
    const stream = await getClient().chat.completions.create({
      model,
      messages: req.messages,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    });
    let promptTokens = 0;
    let completionTokens = 0;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield { delta, done: false };
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens;
        completionTokens = chunk.usage.completion_tokens;
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

  async embed(texts: string[], model = DEFAULT_EMBED_MODEL): Promise<number[][]> {
    const res = await getClient().embeddings.create({ model, input: texts });
    return res.data.map((d) => d.embedding);
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
