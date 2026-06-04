import { ProviderType, ProviderConfig, ConnectionPreset, Capabilities, RequestSkeleton, ModelConfig } from './types.js';
import { registerOpenAICompatible, openaiResponseTransformer, openaiErrorTransformer } from './providers/openai-compatible.js';
import { registerAnthropicCompatible } from './providers/anthropic-compatible.js';
import { registerGLM } from './providers/glm.js';
import { registerQwen } from './providers/qwen.js';
import { registerKimi } from './providers/kimi.js';
import { registerMiniMax } from './providers/minimax.js';
import { registerDoubaoSeed } from './providers/doubao-seed.js';

const providerMap = new Map<ProviderType, ProviderConfig>();

const REQUIRED_KEYS: (keyof ProviderConfig)[] = [
  'type',
  'connectionPreset',
  'capabilities',
  'requestTransformer',
  'responseTransformer',
  'errorTransformer',
];

export function registerProvider(config: ProviderConfig): void {
  for (const key of REQUIRED_KEYS) {
    if (config[key] === undefined || config[key] === null) {
      throw new Error(`Provider registration failed: missing required field "${key}" for type "${config.type}"`);
    }
  }
  if (providerMap.has(config.type)) {
    throw new Error(`Provider registration failed: duplicate type "${config.type}"`);
  }
  providerMap.set(config.type, config);
}

const DEFAULT_CAPABILITIES: Capabilities = { streamSupported: true, toolCallSupported: true, reasoningSupported: true, seedSupported: false };
const DEFAULT_CONNECTION_PRESET: ConnectionPreset = { defaultUrl: 'https://api.openai.com', defaultPath: '/v1/chat/completions', defaultModel: 'gpt-4o', authHeaderName: 'Authorization', authPrefix: 'Bearer ' };
const DEFAULT_PROVIDER: ProviderConfig = {
  type: 'openai-compatible',
  connectionPreset: DEFAULT_CONNECTION_PRESET,
  capabilities: DEFAULT_CAPABILITIES,
  requestTransformer: (skeleton: RequestSkeleton, _config: ModelConfig) => skeleton,
  responseTransformer: openaiResponseTransformer,
  errorTransformer: openaiErrorTransformer,
} satisfies ProviderConfig;

export function getProvider(type: ProviderType): ProviderConfig {
  const provider = providerMap.get(type);
  if (provider) return provider;
  const fallback = providerMap.get('openai-compatible');
  if (fallback) {
    console.warn(`Provider "${type}" not found, falling back to openai-compatible`);
    return fallback;
  }
  console.warn('No provider registered, using hardcoded default');
  return DEFAULT_PROVIDER;
}

export function getAllProviderTypes(): ProviderType[] {
  return Array.from(providerMap.keys());
}

export function getConnectionPreset(type: ProviderType): ConnectionPreset {
  return getProvider(type).connectionPreset;
}

export function getCapabilities(type: ProviderType): Capabilities {
  return getProvider(type).capabilities;
}

export function initProviders(): void {
  registerOpenAICompatible();
  registerAnthropicCompatible();
  registerGLM();
  registerQwen();
  registerKimi();
  registerMiniMax();
  registerDoubaoSeed();
}
