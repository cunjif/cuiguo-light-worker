const CodeNavigationManager = {
    _editorRegistry: new Map(),

    registerNavigation(editor, language, filePath) {
        const disposables = [];
        const level = window.NavigationLevelResolver.resolveEffective(language);

        if (level === 'highlight') {
            return disposables;
        }

        try {
            const hoverDisposable = window.HoverProviderRegistry.register(editor, language, filePath, level);
            if (hoverDisposable) disposables.push(hoverDisposable);
        } catch (e) {}

        if (level === 'highlight_hover' || level === 'highlight_hover_definition' || level === window.LSP_ENHANCED) {
            try {
                const defDisposable = window.DefinitionProviderRegistry.register(editor, language, filePath, level);
                if (defDisposable) disposables.push(defDisposable);
            } catch (e) {}

            try {
                const actionDisposables = window.GoToDefinitionAction.register(editor, language, level);
                if (actionDisposables && actionDisposables.length > 0) {
                    disposables.push(...actionDisposables);
                }
            } catch (e) {}
        }

        if (level === window.LSP_ENHANCED) {
            try {
                const config = window.LSPConfigManager ? window.LSPConfigManager.getConfig(language) : null;
                const triggerChars = config && config.triggerCharacters ? config.triggerCharacters : ['.', '('];
                const completionDisposable = window.LSPCompletionProviderRegistry.register(language, triggerChars);
                if (completionDisposable) disposables.push(completionDisposable);
            } catch (e) {}
        }

        this._editorRegistry.set(filePath, { editor, language, disposables });
        return disposables;
    },

    unregisterNavigation(disposables) {
        if (!disposables || disposables.length === 0) return;
        for (const d of disposables) {
            try { d.dispose(); } catch (e) {}
        }
    },

    onLSPStatusChanged(language, newStatus) {
        for (const [filePath, entry] of this._editorRegistry) {
            if (entry.language !== language) continue;

            this.unregisterNavigation(entry.disposables);
            entry.disposables = [];

            if (newStatus === window.LSP_SERVER_STATUS.READY) {
                entry.disposables = this.registerNavigation(entry.editor, language, filePath);
            } else if (newStatus === window.LSP_SERVER_STATUS.STOPPED ||
                       newStatus === window.LSP_SERVER_STATUS.ERROR ||
                       newStatus === window.LSP_SERVER_STATUS.UNAVAILABLE) {
                const staticLevel = window.NavigationLevelResolver.resolve(language);
                if (staticLevel !== 'highlight') {
                    entry.disposables = this.registerNavigation(entry.editor, language, filePath);
                }
            }
        }
    },

    getEffectiveNavigationLevel(language) {
        return window.NavigationLevelResolver.resolveEffective(language);
    },
};

if (typeof window !== 'undefined') {
    window.CodeNavigationManager = CodeNavigationManager;
}