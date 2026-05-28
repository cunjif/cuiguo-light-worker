import { ProviderType, ProviderConfig, ConnectionPreset, Capabilities } from './types.js';
import { registerOpenAICompatible } from './providers/openai-compatible.js';
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

export function getProvider(type: ProviderType): ProviderConfig {
  const provider = providerMap.get(type);
  if (provider) return provider;
  const fallback = providerMap.get('openai-compatible');
  if (fallback) {
    console.warn(`Provider "${type}" not found, falling back to openai-compatible`);
    return fallback;
  }
  throw new Error('No provider registered, not even openai-compatible fallback');
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
