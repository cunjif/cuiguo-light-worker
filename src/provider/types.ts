export type ProviderType =
  | 'openai-compatible'
  | 'anthropic-compatible'
  | 'glm'
  | 'qwen'
  | 'kimi'
  | 'minimax'
  | 'doubao-seed';

export interface ConnectionPreset {
  defaultUrl: string;
  defaultPath: string;
  defaultModel: string;
  authHeaderName: string;
  authPrefix: string;
}

export interface Capabilities {
  streamSupported: boolean;
  toolCallSupported: boolean;
  reasoningSupported: boolean;
  seedSupported: boolean;
}

export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'end_turn';

export interface ToolCallDelta {
  id?: string;
  function: {
    name?: string;
    arguments?: string;
  };
}

export interface NormalizedDelta {
  content: string;
  reasoning_content: string;
  tool_calls: ToolCallDelta[];
  finish_reason: FinishReason | null;
}

export interface RequestSkeleton {
  messages: unknown[];
  model: string;
  stream: boolean;
  [key: string]: unknown;
}

export interface ModelConfig {
  provider: ProviderType;
  apiKey: string;
  url: string;
  path: string;
  model: string;
  authHeaderName: string;
  authPrefix: string;
  contentType: string;
  max_tokens_type: string;
  max_tokens_value: string;
  temperature: string;
  top_p: string;
  method: string;
  stream: boolean;
  thinking: boolean;
  reasoning_effort: string | null;
  mcp: boolean;
  seed?: number;
  frequency_penalty?: number;
  mask_sensitive_info?: boolean;
}

export type RequestTransformer = (skeleton: RequestSkeleton, config: ModelConfig) => object;
export type ResponseTransformer = (sseChunk: unknown) => NormalizedDelta | null;
export type ErrorTransformer = (errorResponse: unknown) => string;

export interface ProviderConfig {
  type: ProviderType;
  connectionPreset: ConnectionPreset;
  capabilities: Capabilities;
  requestTransformer: RequestTransformer;
  responseTransformer: ResponseTransformer;
  errorTransformer: ErrorTransformer;
}
