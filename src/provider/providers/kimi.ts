import { ProviderConfig, RequestSkeleton, ModelConfig } from '../types.js';
import { registerProvider } from '../registry.js';
import { openaiCompatibleProvider } from './openai-compatible.js';

function kimiRequestTransformer(skeleton: RequestSkeleton, config: ModelConfig): object {
  const body = { ...skeleton } as Record<string, unknown>;
  if (typeof config.reasoning_effort === 'string') {
    body.reasoning_effort = config.reasoning_effort;
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

export const kimiProvider: ProviderConfig = {
  type: 'kimi',
  connectionPreset: {
    defaultUrl: 'https://api.moonshot.cn',
    defaultPath: '/v1/chat/completions',
    defaultModel: 'moonshot-v1-8k',
    authHeaderName: 'Authorization',
    authPrefix: 'Bearer ',
  },
  capabilities: {
    streamSupported: true,
    toolCallSupported: true,
    reasoningSupported: true,
    seedSupported: false,
  },
  requestTransformer: kimiRequestTransformer,
  responseTransformer: openaiCompatibleProvider.responseTransformer,
  errorTransformer: chineseErrorTransformer,
};

export function registerKimi(): void {
  registerProvider(kimiProvider);
}
