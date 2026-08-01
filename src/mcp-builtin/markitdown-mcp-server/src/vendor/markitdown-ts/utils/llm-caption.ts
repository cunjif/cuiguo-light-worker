// Utility for building LLM caption functions from LanguageModelV1 or callback
import type { LanguageModelV1 } from '../types.js';

export function buildLlmCaptionFn(
  options: {
    llmModel?: LanguageModelV1;
    llmPrompt?: string;
    llmCaption?: (buffer: Uint8Array, mimeType: string) => Promise<string>;
  },
): ((buffer: Uint8Array, mimeType: string) => Promise<string>) | undefined {
  // Callback takes precedence
  if (options.llmCaption) return options.llmCaption;

  if (options.llmModel) {
    return async (buffer: Uint8Array, mimeType: string) => {
      const { generateText } = await import('ai');
      const result = await generateText({
        model: options.llmModel!,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: options.llmPrompt ?? 'Write a detailed caption for this image.',
              },
              {
                type: 'image',
                image: buffer,
                mimeType,
              },
            ],
          },
        ],
      });
      return result.text;
    };
  }

  return undefined;
}
