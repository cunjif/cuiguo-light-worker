const GoToDefinitionAction = {
    register(editor, language, level) {
        const disposables = [];

        try {
            const action = editor.addAction({
                id: 'go-to-definition',
                label: 'Go to Definition',
                contextMenuGroupId: 'navigation',
                contextMenuOrder: 1,
                run: async (ed) => {
                    const position = ed.getPosition();
                    if (!position) return;

                    const model = ed.getModel();
                    if (!model) return;

                    try {
                        if (level === window.LSP_ENHANCED) {
                            const lspDef = await GoToDefinitionAction._getLSPDefinition(model, position, language);
                            if (lspDef) {
                                GoToDefinitionAction._navigateToDefinition(ed, lspDef, model);
                                return;
                            }
                        }

                        const worker = await GoToDefinitionAction._getWorker(language);
                        if (worker) {
                            const defs = await worker.getDefinitionAtPosition(
                                model.uri.toString(),
                                model.getOffsetAt(position)
                            );
                            if (defs && defs.length > 0) {
                                const def = defs[0];
                                const targetUri = monaco.Uri.parse(def.uri);
                                if (targetUri.toString() === model.uri.toString()) {
                                    ed.revealLineInCenter(def.startLine);
                                    ed.setPosition({ lineNumber: def.startLine, column: def.startOffset });
                                    ed.focus();
                                } else {
                                    GoToDefinitionAction._openExternalDefinition(targetUri, def.startLine, def.startOffset);
                                }
                                return;
                            }
                        }

                        const localDef = GoToDefinitionAction._findLocalDefinition(model, position, language);
                        if (localDef) {
                            ed.revealLineInCenter(localDef.range.startLineNumber);
                            ed.setPosition({
                                lineNumber: localDef.range.startLineNumber,
                                column: localDef.range.startColumn,
                            });
                            ed.focus();
                            return;
                        }

                        GoToDefinitionAction._showNotFoundHint(ed);
                    } catch (e) {
                        GoToDefinitionAction._showNotFoundHint(ed);
                    }
                },
            });
            disposables.push(action);
        } catch (e) {
        }

        return disposables;
    },

    async _getLSPDefinition(model, position, language) {
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
            return {
                uri: monaco.Uri.parse(def.uri),
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

    _navigateToDefinition(editor, def, currentModel) {
        if (def.uri.toString() === currentModel.uri.toString()) {
            editor.revealLineInCenter(def.range.startLineNumber);
            editor.setPosition({
                lineNumber: def.range.startLineNumber,
                column: def.range.startColumn,
            });
            editor.focus();
        } else {
            GoToDefinitionAction._openExternalDefinition(
                def.uri,
                def.range.startLineNumber,
                def.range.startColumn
            );
        }
    },

    _findLocalDefinition(model, position, language) {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        const wordText = word.word;
        const matches = model.findMatches(wordText, false, false, true, null, false);
        if (!matches || matches.length === 0) return null;

        const patterns = window.DefinitionProviderRegistry._getDefinitionPatterns(language);
        for (const match of matches) {
            if (match.range.startLineNumber === position.lineNumber &&
                match.range.startColumn === word.startColumn) {
                continue;
            }
            const lineContent = model.getLineContent(match.range.startLineNumber);
            for (const pattern of patterns) {
                if (pattern.test(lineContent)) {
                    return {
                        uri: model.uri,
                        range: match.range,
                    };
                }
            }
        }
        return null;
    },

    _showNotFoundHint(editor) {
        const domNode = document.createElement('div');
        domNode.className = 'definition-not-found-hint';
        domNode.textContent = '未找到定义';
        domNode.style.cssText = [
            'position:absolute',
            'z-index:100',
            'background:#333',
            'color:#fff',
            'padding:4px 8px',
            'border-radius:4px',
            'font-size:12px',
            'pointer-events:none',
            'opacity:0.9',
            'transition:opacity 0.3s',
        ].join(';');

        const position = editor.getPosition();
        if (!position) return;

        const coords = editor.getScrolledVisiblePosition(position);
        if (!coords) return;

        domNode.style.left = coords.left + 'px';
        domNode.style.top = (coords.top + coords.height + 4) + 'px';

        editor.getDomNode().appendChild(domNode);

        setTimeout(() => {
            domNode.style.opacity = '0';
            setTimeout(() => {
                if (domNode.parentNode) domNode.parentNode.removeChild(domNode);
            }, 300);
        }, 3000);
    },

    async _openExternalDefinition(targetUri, startLine, startColumn) {
        const filePath = targetUri.fsPath || targetUri.path;
        if (window.editorTabStore && window.editorTabStore.openTab) {
            window.editorTabStore.openTab(filePath);
            setTimeout(() => {
                const ed = window.editorTabStore.editorInstances
                    ? window.editorTabStore.editorInstances[filePath]
                    : null;
                if (ed) {
                    ed.revealLineInCenter(startLine);
                    ed.setPosition({
                        lineNumber: startLine,
                        column: startColumn,
                    });
                    ed.focus();
                }
            }, 300);
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
    window.GoToDefinitionAction = GoToDefinitionAction;
}