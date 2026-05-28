import { ProviderConfig, RequestSkeleton, ModelConfig } from '../types.js';
import { registerProvider } from '../registry.js';
import { openaiCompatibleProvider } from './openai-compatible.js';

function doubaoSeedRequestTransformer(skeleton: RequestSkeleton, config: ModelConfig): object {
  const body = { ...skeleton } as Record<string, unknown>;
  if (config.seed !== undefined && config.seed !== null) {
    body.seed = config.seed;
  }
  if (config.frequency_penalty !== undefined && config.frequency_penalty !== null) {
    body.frequency_penalty = config.frequency_penalty;
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

export const doubaoSeedProvider: ProviderConfig = {
  type: 'doubao-seed',
  connectionPreset: {
    defaultUrl: 'https://ark.cn-beijing.volces.com',
    defaultPath: '/api/v3/chat/completions',
    defaultModel: 'doubao-pro-32k',
    authHeaderName: 'Authorization',
    authPrefix: 'Bearer ',
  },
  capabilities: {
    streamSupported: true,
    toolCallSupported: true,
    reasoningSupported: false,
    seedSupported: true,
  },
  requestTransformer: doubaoSeedRequestTransformer,
  responseTransformer: openaiCompatibleProvider.responseTransformer,
  errorTransformer: chineseErrorTransformer,
};

export function registerDoubaoSeed(): void {
  registerProvider(doubaoSeedProvider);
}
