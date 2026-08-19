import { ProviderConfig } from '../types.js';
import { registerProvider } from '../registry.js';
import { openaiCompatibleProvider } from './openai-compatible.js';

export const icbcCompatibleProvider: ProviderConfig = {
  type: 'icbc-compatible',
  connectionPreset: {
    defaultUrl: 'https://api.openai.com',
    defaultPath: '/v1/chat/completions',
    defaultModel: 'gpt-4o',
    authHeaderName: 'Authorization',
    authPrefix: '',
  },
  capabilities: {
    streamSupported: true,
    toolCallSupported: true,
    reasoningSupported: true,
    seedSupported: false,
  },
  requestTransformer: openaiCompatibleProvider.requestTransformer,
  responseTransformer: openaiCompatibleProvider.responseTransformer,
  errorTransformer: openaiCompatibleProvider.errorTransformer,
};

export function registerICBCCompatible(): void {
  registerProvider(icbcCompatibleProvider);
}