/** AI 抽象层类型（Spec §7.1）。切厂商/模型只改配置，调用方只依赖这些接口。 */

export type Provider = "openai" | "anthropic";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
  jsonSchema?: object;
  cachePrompt?: boolean;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export interface LLMResponse {
  text: string;
  json?: unknown;
  usage: LLMUsage;
  provider: Provider;
  model: string;
}

export interface LLMStreamChunk {
  delta: string;
  done: boolean;
  usage?: LLMUsage;
}

export interface LLMProvider {
  readonly name: Provider;
  complete(req: LLMRequest): Promise<LLMResponse>;
  stream(req: LLMRequest): AsyncIterable<LLMStreamChunk>;
  embed(texts: string[], model?: string): Promise<number[][]>;
  estimateCost(
    u: { promptTokens: number; completionTokens: number },
    model: string,
  ): number;
}

/** 任务画像（Spec §7.2）。 */
export type TaskProfile =
  | "file_card"
  | "symbol_card"
  | "module_arch"
  | "structure_gen"
  | "edge_nl"
  | "exec_path"
  | "explain"
  | "tagging"
  | "embedding"
  | "generalize_note";

export interface ProfileConfig {
  provider: Provider;
  model: string;
  temperature?: number;
  maxTokens?: number;
  batch?: boolean;
  cache?: boolean;
}
