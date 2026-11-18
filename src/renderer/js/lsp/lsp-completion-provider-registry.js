const LSPCompletionProviderRegistry = {
    register(language, triggerCharacters) {
        try {
            const provider = {
                triggerCharacters: triggerCharacters || ['.', '('],
                provideCompletionItems: async (model, position) => {
                    try {
                        if (!window.LSPBridge.isLanguageServerReady(language)) {
                            return { suggestions: [] };
                        }

                        const uri = model.uri.toString();
                        const result = await window.LSPBridge.sendRequest(
                            language,
                            'textDocument/completion',
                            {
                                textDocument: { uri },
                                position: {
                                    line: position.lineNumber - 1,
                                    character: position.column - 1,
                                },
                            },
                            800
                        );

                        if (!result || !result.items) {
                            return { suggestions: [] };
                        }

                        const suggestions = result.items
                            .filter(item => item.label && typeof item.label === 'string')
                            .map(item => ({
                                label: item.label,
                                kind: LSPCompletionProviderRegistry._mapKind(item.kind),
                                documentation: item.documentation || null,
                                insertText: item.insertText || item.label,
                                sortText: item.sortText || null,
                                preselect: item.preselect || false,
                            }));

                        suggestions.sort((a, b) => {
                            if (a.preselect && !b.preselect) return -1;
                            if (!a.preselect && b.preselect) return 1;
                            if (a.sortText && b.sortText) return a.sortText.localeCompare(b.sortText);
                            return 0;
                        });

                        return { suggestions };
                    } catch (e) {
                        return { suggestions: [] };
                    }
                },
            };

            return monaco.languages.registerCompletionItemProvider(language, provider);
        } catch (e) {
            return null;
        }
    },

    _mapKind(lspKind) {
        const kindMap = {
            1: monaco.languages.CompletionItemKind.Text,
            2: monaco.languages.CompletionItemKind.Method,
            3: monaco.languages.CompletionItemKind.Function,
            4: monaco.languages.CompletionItemKind.Constructor,
            5: monaco.languages.CompletionItemKind.Field,
            6: monaco.languages.CompletionItemKind.Variable,
            7: monaco.languages.CompletionItemKind.Class,
            8: monaco.languages.CompletionItemKind.Interface,
            9: monaco.languages.CompletionItemKind.Module,
            10: monaco.languages.CompletionItemKind.Property,
            11: monaco.languages.CompletionItemKind.Unit,
            12: monaco.languages.CompletionItemKind.Value,
            13: monaco.languages.CompletionItemKind.Enum,
            14: monaco.languages.CompletionItemKind.Keyword,
            15: monaco.languages.CompletionItemKind.Snippet,
            16: monaco.languages.CompletionItemKind.Color,
            17: monaco.languages.CompletionItemKind.File,
            18: monaco.languages.CompletionItemKind.Reference,
            19: monaco.languages.CompletionItemKind.Folder,
            20: monaco.languages.CompletionItemKind.EnumMember,
            21: monaco.languages.CompletionItemKind.Constant,
            22: monaco.languages.CompletionItemKind.Struct,
            23: monaco.languages.CompletionItemKind.Event,
            24: monaco.languages.CompletionItemKind.Operator,
            25: monaco.languages.CompletionItemKind.TypeParameter,
        };
        return kindMap[lspKind] || monaco.languages.CompletionItemKind.Text;
    },

    unregister(disposable) {
        try { if (disposable) disposable.dispose(); } catch (e) {}
    },
};

if (typeof window !== 'undefined') {
    window.LSPCompletionProviderRegistry = LSPCompletionProviderRegistry;
}