import { ProviderConfig, NormalizedDelta, RequestSkeleton, ModelConfig } from '../types.js';
import { registerProvider } from '../registry.js';

function openaiResponseTransformer(sseChunk: unknown): NormalizedDelta | null {
  const chunk = sseChunk as Record<string, unknown>;
  if ('choices' in chunk && Array.isArray(chunk.choices) && chunk.choices.length > 0) {
    const choice = chunk.choices[0];
    const delta = (choice.delta || choice.message) as Record<string, unknown>;
    if (!delta) return null;
    return {
      content: typeof delta.content === 'string' ? delta.content : '',
      reasoning_content: typeof delta.reasoning_content === 'string' ? delta.reasoning_content : '',
      tool_calls: Array.isArray(delta.tool_calls) ? delta.tool_calls : [],
      finish_reason: choice.finish_reason || null,
    };
  }
  if ('response' in chunk) {
    const resp = chunk.response as Record<string, unknown>;
    if (!resp) return null;
    return {
      content: typeof resp.content === 'string' ? resp.content : '',
      reasoning_content: '',
      tool_calls: [],
      finish_reason: null,
    };
  }
  return null;
}

function openaiErrorTransformer(errorResponse: unknown): string {
  const err = errorResponse as Record<string, unknown>;
  if (err.error && typeof err.error === 'object') {
    const errorObj = err.error as Record<string, unknown>;
    if (typeof errorObj.message === 'string') return errorObj.message;
  }
  if (Array.isArray(err.detail) && err.detail.length > 0) {
    const detail = err.detail[0] as Record<string, unknown>;
    if (typeof detail.msg === 'string') {
      const loc = detail.loc ? ` - ${detail.loc}:` : ':';
      return `${loc} ${detail.msg}`;
    }
  }
  return String(err.message || 'Unknown error');
}

export const openaiCompatibleProvider: ProviderConfig = {
  type: 'openai-compatible',
  connectionPreset: {
    defaultUrl: 'https://api.openai.com',
    defaultPath: '/v1/chat/completions',
    defaultModel: 'gpt-4o',
    authHeaderName: 'Authorization',
    authPrefix: 'Bearer ',
  },
  capabilities: {
    streamSupported: true,
    toolCallSupported: true,
    reasoningSupported: true,
    seedSupported: false,
  },
  requestTransformer: (skeleton: RequestSkeleton, _config: ModelConfig) => skeleton,
  responseTransformer: openaiResponseTransformer,
  errorTransformer: openaiErrorTransformer,
};

export function registerOpenAICompatible(): void {
  registerProvider(openaiCompatibleProvider);
}
