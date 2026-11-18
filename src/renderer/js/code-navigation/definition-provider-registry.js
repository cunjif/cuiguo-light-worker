const DefinitionProviderRegistry = {
    register(editor, language, filePath, level) {
        try {
            const provider = {
                provideDefinition: async (model, position) => {
                    try {
                        if (level === window.LSP_ENHANCED) {
                            const lspResult = await DefinitionProviderRegistry._provideLSPDefinition(model, position, language);
                            if (lspResult) return lspResult;
                        }

                        const worker = await DefinitionProviderRegistry._getWorker(language);
                        if (worker) {
                            const defs = await worker.getDefinitionAtPosition(
                                model.uri.toString(),
                                model.getOffsetAt(position)
                            );
                            if (defs && defs.length > 0) {
                                const def = defs[0];
                                const targetUri = monaco.Uri.parse(def.uri);
                                return {
                                    uri: targetUri,
                                    range: {
                                        startLineNumber: def.startLine,
                                        startColumn: def.startOffset,
                                        endLineNumber: def.endLine,
                                        endColumn: def.endOffset,
                                    },
                                };
                            }
                        }

                        return DefinitionProviderRegistry._provideLocalDefinition(model, position, language);
                    } catch (e) {
                        return null;
                    }
                },
            };

            const disposable = monaco.languages.registerDefinitionProvider(language, provider);
            return disposable;
        } catch (e) {
            return null;
        }
    },

    _provideLocalDefinition(model, position, language) {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        const wordText = word.word;
        const matchCount = model.findMatches(wordText, false, false, true, null, false);
        if (!matchCount || matchCount.length === 0) return null;

        const definitionPatterns = DefinitionProviderRegistry._getDefinitionPatterns(language);
        for (const match of matchCount) {
            if (match.range.startLineNumber === position.lineNumber &&
                match.range.startColumn === word.startColumn) {
                continue;
            }
            const lineContent = model.getLineContent(match.range.startLineNumber);
            for (const pattern of definitionPatterns) {
                if (pattern.test(lineContent)) {
                    return {
                        uri: model.uri,
                        range: {
                            startLineNumber: match.range.startLineNumber,
                            startColumn: match.range.startColumn,
                            endLineNumber: match.range.startLineNumber,
                            endColumn: match.range.endColumn,
                        },
                    };
                }
            }
        }
        return null;
    },

    _getDefinitionPatterns(language) {
        const patterns = {
            python: [
                /^\s*def\s+/,
                /^\s*class\s+/,
                /^\s*import\s+/,
                /^\s*from\s+\S+\s+import\s+/,
            ],
            java: [
                /^\s*(public|private|protected|static|final)?\s*(class|interface|enum|void|int|String|boolean|double|float|long|short|byte|char)\s+/,
                /^\s*(public|private|protected|static|final)?\s*\w+\s+\w+\s*\(/,
            ],
            go: [
                /^\s*func\s+/,
                /^\s*type\s+/,
                /^\s*var\s+/,
                /^\s*const\s+/,
                /^\s*import\s+/,
            ],
            rust: [
                /^\s*fn\s+/,
                /^\s*struct\s+/,
                /^\s*enum\s+/,
                /^\s*trait\s+/,
                /^\s*impl\s+/,
                /^\s*use\s+/,
            ],
            c: [
                /^\s*(int|void|char|float|double|long|short|unsigned|static|struct|enum|typedef|#define)\s+/,
            ],
            cpp: [
                /^\s*(int|void|char|float|double|long|short|unsigned|static|struct|class|enum|typedef|namespace|#define)\s+/,
            ],
            csharp: [
                /^\s*(public|private|protected|internal|static|class|interface|enum|struct|void|int|string|bool|double|float)\s+/,
            ],
            php: [
                /^\s*function\s+/,
                /^\s*class\s+/,
                /^\s*interface\s+/,
                /^\s*(public|private|protected|static)?\s*\$\w+\s*=/,
            ],
            ruby: [
                /^\s*def\s+/,
                /^\s*class\s+/,
                /^\s*module\s+/,
                /^\s*require_/,
            ],
            kotlin: [
                /^\s*fun\s+/,
                /^\s*class\s+/,
                /^\s*object\s+/,
                /^\s*interface\s+/,
                /^\s*val\s+/,
                /^\s*var\s+/,
                /^\s*import\s+/,
            ],
            swift: [
                /^\s*func\s+/,
                /^\s*class\s+/,
                /^\s*struct\s+/,
                /^\s*enum\s+/,
                /^\s*protocol\s+/,
                /^\s*let\s+/,
                /^\s*var\s+/,
                /^\s*import\s+/,
            ],
            scala: [
                /^\s*def\s+/,
                /^\s*class\s+/,
                /^\s*object\s+/,
                /^\s*trait\s+/,
                /^\s*val\s+/,
                /^\s*var\s+/,
                /^\s*import\s+/,
            ],
            javascript: [
                /^\s*function\s+/,
                /^\s*class\s+/,
                /^\s*(const|let|var)\s+/,
                /^\s*import\s+/,
            ],
            typescript: [
                /^\s*function\s+/,
                /^\s*class\s+/,
                /^\s*interface\s+/,
                /^\s*(const|let|var)\s+/,
                /^\s*import\s+/,
                /^\s*type\s+/,
                /^\s*enum\s+/,
            ],
        };
        return patterns[language] || [
            /^\s*(function|class|def|func|type|const|let|var|import)\s+/,
        ];
    },

    async _provideLSPDefinition(model, position, language) {
        try {
            if (!window.LSPBridge.isLanguageServerReady(language)) return null;

            const result = await window.LSPBridge.sendRequest(
                language,
                'textDocument/definition',
                {
                    textDocument: { uri: model.uri.toString() },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                    },
                },
                1000
            );

            if (!result) return null;

            const defs = Array.isArray(result) ? result : [result];
            if (defs.length === 0) return null;

            const def = defs[0];
            const targetUri = monaco.Uri.parse(def.uri);

            return {
                uri: targetUri,
                range: {
                    startLineNumber: def.range.start.line + 1,
                    startColumn: def.range.start.character + 1,
                    endLineNumber: def.range.end.line + 1,
                    endColumn: def.range.end.character + 1,
                },
            };
        } catch (e) {
            return null;
        }
    },

    async _getWorker(language) {
        try {
            if (language === 'typescript') {
                const workerFn = await monaco.languages.typescript.getTypeScriptWorker();
                return await workerFn();
            }
            if (language === 'javascript') {
                const workerFn = await monaco.languages.typescript.getJavaScriptWorker();
                return await workerFn();
            }
        } catch (e) {
        }
        return null;
    },
};

if (typeof window !== 'undefined') {
    window.DefinitionProviderRegistry = DefinitionProviderRegistry;
}