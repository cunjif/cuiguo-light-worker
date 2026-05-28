import { ProviderType, NormalizedDelta } from './types.js';
import { getProvider } from './registry.js';

export function normalizeSSEChunk(
  providerType: ProviderType,
  rawChunk: unknown
): NormalizedDelta | null {
  try {
    const provider = getProvider(providerType);
    return provider.responseTransformer(rawChunk);
  } catch (e) {
    console.warn(`Response transformer for "${providerType}" failed, discarding chunk:`, e);
    return null;
  }
}
