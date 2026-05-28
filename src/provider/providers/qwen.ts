import { ProviderConfig } from '../types.js';
import { registerProvider } from '../registry.js';
import { openaiCompatibleProvider } from './openai-compatible.js';

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

export const qwenProvider: ProviderConfig = {
  type: 'qwen',
  connectionPreset: {
    defaultUrl: 'https://dashscope.aliyuncs.com',
    defaultPath: '/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-plus',
    authHeaderName: 'Authorization',
    authPrefix: 'Bearer ',
  },
  capabilities: {
    streamSupported: true,
    toolCallSupported: true,
    reasoningSupported: true,
    seedSupported: false,
  },
  requestTransformer: openaiCompatibleProvider.requestTransformer,
  responseTransformer: openaiCompatibleProvider.responseTransformer,
  errorTransformer: chineseErrorTransformer,
};

export function registerQwen(): void {
  registerProvider(qwenProvider);
}
