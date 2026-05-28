import { ProviderConfig, RequestSkeleton, ModelConfig } from '../types.js';
import { registerProvider } from '../registry.js';
import { openaiCompatibleProvider } from './openai-compatible.js';

function glmRequestTransformer(skeleton: RequestSkeleton, config: ModelConfig): object {
  const body = { ...skeleton } as Record<string, unknown>;
  if (config.temperature && parseFloat(config.temperature) > 0) {
    body.do_sample = true;
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

export const glmProvider: ProviderConfig = {
  type: 'glm',
  connectionPreset: {
    defaultUrl: 'https://open.bigmodel.cn',
    defaultPath: '/api/paas/v4/chat/completions',
    defaultModel: 'glm-4',
    authHeaderName: 'Authorization',
    authPrefix: 'Bearer ',
  },
  capabilities: {
    streamSupported: true,
    toolCallSupported: true,
    reasoningSupported: true,
    seedSupported: false,
  },
  requestTransformer: glmRequestTransformer,
  responseTransformer: openaiCompatibleProvider.responseTransformer,
  errorTransformer: chineseErrorTransformer,
};

export function registerGLM(): void {
  registerProvider(glmProvider);
}
