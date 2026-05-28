import { ModelConfig, ProviderType } from './types.js';

export function migrateConfig(config: Record<string, unknown>): ModelConfig {
  const result = { ...config } as Record<string, unknown>;

  if (!result.provider || typeof result.provider !== 'string') {
    result.provider = 'openai-compatible' as ProviderType;
  }

  return result as unknown as ModelConfig;
}

export function migrateAllConfigs(): void {
  try {
    const keysToCheck = Object.keys(localStorage);

    for (const key of keysToCheck) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;

        const parsed = JSON.parse(raw);

        if (parsed && typeof parsed === 'object' && parsed.apiKey !== undefined && parsed.url !== undefined) {
          if (!parsed.provider) {
            const migrated = migrateConfig(parsed);
            localStorage.setItem(key, JSON.stringify(migrated));
          }
        }
      } catch (e) {
        console.warn(`Failed to migrate config for key "${key}":`, e);
      }
    }
  } catch (e) {
    console.warn('localStorage not available, migration skipped:', e);
  }
}
