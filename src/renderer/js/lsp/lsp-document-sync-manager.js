const LSPDocumentSyncManager = {
    _documents: new Map(),
    _debounceTimers: new Map(),

    onModelCreated(model, language) {
        const uri = model.uri.toString();
        this._documents.set(uri, { language, version: 0, model });

        try {
            window.LSPBridge.sendNotification(language, 'textDocument/didOpen', {
                textDocument: {
                    uri,
                    languageId: language,
                    version: 0,
                    text: model.getValue(),
                },
            });
        } catch (e) {}
    },

    onModelContentChanged(model, event) {
        const uri = model.uri.toString();
        const doc = this._documents.get(uri);
        if (!doc) return;

        if (this._debounceTimers.has(uri)) {
            clearTimeout(this._debounceTimers.get(uri));
        }

        this._debounceTimers.set(uri, setTimeout(() => {
            doc.version++;
            try {
                window.LSPBridge.sendNotification(doc.language, 'textDocument/didChange', {
                    textDocument: { uri, version: doc.version },
                    contentChanges: [{ text: model.getValue() }],
                });
            } catch (e) {}
            this._debounceTimers.delete(uri);
        }, 500));
    },

    onModelDisposed(model) {
        const uri = model.uri.toString();
        const doc = this._documents.get(uri);
        if (!doc) return;

        if (this._debounceTimers.has(uri)) {
            clearTimeout(this._debounceTimers.get(uri));
            this._debounceTimers.delete(uri);
        }

        try {
            window.LSPBridge.sendNotification(doc.language, 'textDocument/didClose', {
                textDocument: { uri },
            });
        } catch (e) {}

        this._documents.delete(uri);
    },

    resyncAllDocuments(language) {
        for (const [uri, doc] of this._documents) {
            if (doc.language !== language) continue;
            doc.version = 0;
            try {
                window.LSPBridge.sendNotification(language, 'textDocument/didOpen', {
                    textDocument: {
                        uri,
                        languageId: language,
                        version: 0,
                        text: doc.model.getValue(),
                    },
                });
            } catch (e) {}
        }
    },
};

if (typeof window !== 'undefined') {
    window.LSPDocumentSyncManager = LSPDocumentSyncManager;
}