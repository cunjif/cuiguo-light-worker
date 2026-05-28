import { ProviderConfig, RequestSkeleton, ModelConfig } from '../types.js';
import { registerProvider } from '../registry.js';
import { openaiCompatibleProvider } from './openai-compatible.js';

function minimaxRequestTransformer(skeleton: RequestSkeleton, config: ModelConfig): object {
  const body = { ...skeleton } as Record<string, unknown>;
  if (config.mask_sensitive_info) {
    body.mask_sensitive_info = true;
  }
  return body;
}

function chineseErrorTransformer(errorResponse: unknown): string {
  const err = errorResponse as Record<string, unknown>;
  if (Array.isArray(err.detail) && err.detail.length > 0) {
    const detail = err.detail[0] as Record<string, unknown>;
    if (typeof detail.msg === 'string') {
      const loc = detail.loc ? ` - ${detail.loc}:` : ':';
      return `${loc} ${detail.msg}`;
    }
  }
  if (err.error && typeof err.error === 'object') {
    const errorObj = err.error as Record<string, unknown>;
    if (typeof errorObj.message === 'string') return errorObj.message;
  }
  return String(err.message || 'Unknown error');
}

export const minimaxProvider: ProviderConfig = {
  type: 'minimax',
  connectionPreset: {
    defaultUrl: 'https://api.minimax.chat',
    defaultPath: '/v1/text/chatcompletion_v2',
    defaultModel: 'MiniMax-Text-01',
    authHeaderName: 'Authorization',
    authPrefix: 'Bearer ',
  },
  capabilities: {
    streamSupported: true,
    toolCallSupported: true,
    reasoningSupported: false,
    seedSupported: false,
  },
  requestTransformer: minimaxRequestTransformer,
  responseTransformer: openaiCompatibleProvider.responseTransformer,
  errorTransformer: chineseErrorTransformer,
};

export function registerMiniMax(): void {
  registerProvider(minimaxProvider);
}
