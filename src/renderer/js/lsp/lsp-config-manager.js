const DEFAULT_LSP_CONFIG = {
    python: {
        enabled: false,
        command: 'pyright-langserver',
        args: ['--stdio'],
        rootUri: '',
        triggerCharacters: ['.', '('],
    },
    java: {
        enabled: false,
        command: 'jdtls',
        args: ['--stdio'],
        rootUri: '',
        triggerCharacters: ['.', '(', '<'],
    },
};

const LSPConfigManager = {
    _config: null,
    _callbacks: new Set(),

    getConfig(language) {
        if (!this._config) return null;
        return this._config[language] || null;
    },

    getAllConfig() {
        return this._config;
    },

    getDefaultConfig() {
        return JSON.parse(JSON.stringify(DEFAULT_LSP_CONFIG));
    },

    async loadConfig() {
        try {
            if (!window.lspConfigAPI) {
                this._config = JSON.parse(JSON.stringify(DEFAULT_LSP_CONFIG));
                return this._config;
            }
            const saved = await window.lspConfigAPI.load();
            if (saved) {
                this._config = saved;
            } else {
                this._config = JSON.parse(JSON.stringify(DEFAULT_LSP_CONFIG));
            }
            return this._config;
        } catch (e) {
            this._config = JSON.parse(JSON.stringify(DEFAULT_LSP_CONFIG));
            return this._config;
        }
    },

    async saveConfig(config) {
        try {
            if (!window.lspConfigAPI) {
                return { success: false, error: 'lspConfigAPI not available' };
            }
            const result = await window.lspConfigAPI.save(config);
            if (result && result.success) {
                this._config = config;
                this._notifyCallbacks();
            }
            return result;
        } catch (e) {
            return { success: false, error: String(e) };
        }
    },

    validatePath(serverPath) {
        if (!serverPath || typeof serverPath !== 'string') {
            return { valid: false, error: '路径不能为空' };
        }
        if (serverPath.includes('..')) {
            return { valid: false, error: '路径不能包含相对路径引用' };
        }
        return { valid: true };
    },

    onConfigChanged(callback) {
        this._callbacks.add(callback);
        return () => this._callbacks.delete(callback);
    },

    _notifyCallbacks() {
        for (const cb of this._callbacks) {
            try { cb(this._config); } catch (e) {}
        }
    },
};

if (typeof window !== 'undefined') {
    window.LSPConfigManager = LSPConfigManager;
    window.DEFAULT_LSP_CONFIG = DEFAULT_LSP_CONFIG;
}