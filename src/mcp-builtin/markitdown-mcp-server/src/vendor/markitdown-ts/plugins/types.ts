// src/plugins/types.ts
// Re-export plugin interfaces for plugin authors
export type {
  MarkItDownPlugin,
  MarkItDownRegistrar,
  DocumentConverter,
  ConvertResult,
  ConverterInput,
  StreamInfo,
  InternalConvertOptions,
} from '../types.js';
export { PRIORITY_SPECIFIC, PRIORITY_GENERIC } from '../constants.js';
