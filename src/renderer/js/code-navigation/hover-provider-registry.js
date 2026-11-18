const HoverProviderRegistry = {
    register(editor, language, filePath, level) {
        if (level === 'highlight') return null;

        try {
            const provider = {
                provideHover: async (model, position) => {
                    try {
                        if (level === window.LSP_ENHANCED) {
                            const lspResult = await HoverProviderRegistry._provideLSPHover(model, position, language);
                            if (lspResult) return lspResult;
                            const staticLevel = window.NavigationLevelResolver.resolve(language);
                            if (staticLevel === 'highlight_hover_definition') {
                                return await HoverProviderRegistry._provideFullHover(model, position, language);
                            }
                            return await HoverProviderRegistry._provideBasicHover(model, position, language);
                        }
                        if (level === 'highlight_hover_definition') {
                            return await HoverProviderRegistry._provideFullHover(model, position, language);
                        }
                        return await HoverProviderRegistry._provideBasicHover(model, position, language);
                    } catch (e) {
                        return null;
                    }
                },
            };

            const disposable = monaco.languages.registerHoverProvider(language, provider);
            return disposable;
        } catch (e) {
            return null;
        }
    },

    async _provideLSPHover(model, position, language) {
        try {
            if (!window.LSPBridge.isLanguageServerReady(language)) return null;

            const result = await window.LSPBridge.sendRequest(
                language,
                'textDocument/hover',
                {
                    textDocument: { uri: model.uri.toString() },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                    },
                },
                500
            );

            if (!result || !result.contents) return null;

            const contents = [];
            if (typeof result.contents === 'string') {
                contents.push({ value: result.contents });
            } else if (Array.isArray(result.contents)) {
                for (const item of result.contents) {
                    if (typeof item === 'string') {
                        contents.push({ value: item });
                    } else if (item && item.value) {
                        contents.push({ value: item.value });
                    }
                }
            } else if (result.contents && result.contents.value) {
                contents.push({ value: result.contents.value });
            }

            if (contents.length === 0) return null;

            const word = model.getWordAtPosition(position);
            const range = result.range ? {
                startLineNumber: result.range.start.line + 1,
                startColumn: result.range.start.character + 1,
                endLineNumber: result.range.end.line + 1,
                endColumn: result.range.end.character + 1,
            } : word ? {
                startLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endLineNumber: position.lineNumber,
                endColumn: word.endColumn,
            } : null;

            return { contents, range };
        } catch (e) {
            return null;
        }
    },

    async _provideFullHover(model, position, language) {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        const lineContent = model.getLineContent(position.lineNumber);
        const hoverContents = [];

        try {
            const worker = await HoverProviderRegistry._getWorker(language);
            if (worker) {
                const info = await worker.getQuickInfoAtPosition(
                    model.uri.toString(),
                    model.getOffsetAt(position)
                );
                if (info && info.displayParts) {
                    const signature = info.displayParts.map(p => p.text).join('');
                    hoverContents.push({ value: '```' + language + '\n' + signature + '\n```' });
                }
                if (info && info.documentation) {
                    hoverContents.push({ value: info.documentation });
                }
            }
        } catch (e) {
        }

        if (hoverContents.length === 0) {
            hoverContents.push({
                value: '**' + word.word + '** — `' + language + '` line ' + position.lineNumber,
            });
        }

        return {
            contents: hoverContents,
            range: {
                startLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endLineNumber: position.lineNumber,
                endColumn: word.endColumn,
            },
        };
    },

    async _provideBasicHover(model, position, language) {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        return {
            contents: [
                { value: '**' + word.word + '** — `' + language + '` line ' + position.lineNumber },
            ],
            range: {
                startLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endLineNumber: position.lineNumber,
                endColumn: word.endColumn,
            },
        };
    },

    async _getWorker(language) {
        try {
            if (language === 'typescript' || language === 'javascript') {
                const workerFn = await monaco.languages.typescript.getTypeScriptWorker();
                return await workerFn();
            }
        } catch (e) {
        }
        return null;
    },
};

if (typeof window !== 'undefined') {
    window.HoverProviderRegistry = HoverProviderRegistry;
}