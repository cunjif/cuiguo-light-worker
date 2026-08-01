import type { LanguageModelV1 } from '../types.js';
export declare function buildLlmCaptionFn(options: {
    llmModel?: LanguageModelV1;
    llmPrompt?: string;
    llmCaption?: (buffer: Uint8Array, mimeType: string) => Promise<string>;
}): ((buffer: Uint8Array, mimeType: string) => Promise<string>) | undefined;
