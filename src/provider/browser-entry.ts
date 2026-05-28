import { initProviders, getAllProviderTypes, getConnectionPreset, getCapabilities, adaptRequest, normalizeSSEChunk, normalizeError, migrateAllConfigs } from './index.js';

const ProviderAPI = {
  initProviders,
  getAllProviderTypes,
  getConnectionPreset,
  getCapabilities,
  adaptRequest,
  normalizeSSEChunk,
  normalizeError,
  migrateAllConfigs,
};

(window as unknown as Record<string, unknown>).ProviderAPI = ProviderAPI;

export default ProviderAPI;
