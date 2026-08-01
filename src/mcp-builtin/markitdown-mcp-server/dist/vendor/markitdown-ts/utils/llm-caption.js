export function buildLlmCaptionFn(options) {
    // Callback takes precedence
    if (options.llmCaption)
        return options.llmCaption;
    if (options.llmModel) {
        return async (buffer, mimeType) => {
            const { generateText } = await import('ai');
            const result = await generateText({
                model: options.llmModel,
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
//# sourceMappingURL=llm-caption.js.map