import { ProviderType } from './types.js';
import { getProvider } from './registry.js';

export function normalizeError(
  providerType: ProviderType,
  errorResponse: unknown,
  apiKey?: string
): string {
  let message: string;
  try {
    const provider = getProvider(providerType);
    message = provider.errorTransformer(errorResponse);
  } catch (e) {
    console.warn(`Error transformer for "${providerType}" failed, using fallback:`, e);
    const err = errorResponse as Record<string, unknown>;
    message = String(err.message || 'Unknown error');
  }

  if (apiKey && message.includes(apiKey)) {
    message = message.replace(new RegExp(escapeRegExp(apiKey), 'g'), '***REDACTED***');
  }

  return message;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
