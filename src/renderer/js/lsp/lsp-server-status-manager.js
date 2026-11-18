const LSP_SERVER_STATUS = {
    STOPPED: 'stopped',
    STARTING: 'starting',
    READY: 'ready',
    ERROR: 'error',
    UNAVAILABLE: 'unavailable',
};

const LSPServerStatusManager = {
    _statusMap: new Map(),
    _callbacks: new Map(),

    getStatus(language) {
        if (this._statusMap.has(language)) {
            return this._statusMap.get(language);
        }
        try {
            if (window.lspAPI) {
                const status = window.lspAPI.getStatus(language);
                if (status) {
                    this._statusMap.set(language, status);
                    return status;
                }
            }
        } catch (e) {
        }
        return LSP_SERVER_STATUS.STOPPED;
    },

    onStatusChanged(language, callback) {
        const key = language;
        if (!this._callbacks.has(key)) {
            this._callbacks.set(key, new Set());
        }
        this._callbacks.get(key).add(callback);
        return () => {
            const cbs = this._callbacks.get(key);
            if (cbs) cbs.delete(callback);
        };
    },

    _notifyCallbacks(language, status) {
        const langCbs = this._callbacks.get(language);
        if (langCbs) {
            for (const cb of langCbs) {
                try { cb(status); } catch (e) {}
            }
        }
        const allCbs = this._callbacks.get('*');
        if (allCbs) {
            for (const cb of allCbs) {
                try { cb(language, status); } catch (e) {}
            }
        }
    },

    async startServer(language) {
        try {
            if (!window.lspAPI) return false;
            const config = window.LSPConfigManager.getConfig(language);
            if (!config || !config.enabled) return false;
            this._statusMap.set(language, LSP_SERVER_STATUS.STARTING);
            this._notifyCallbacks(language, LSP_SERVER_STATUS.STARTING);
            const result = await window.lspAPI.startServer(
                language, config.command, config.args, config.rootUri
            );
            return result && result.success;
        } catch (e) {
            this._statusMap.set(language, LSP_SERVER_STATUS.ERROR);
            this._notifyCallbacks(language, LSP_SERVER_STATUS.ERROR);
            return false;
        }
    },

    async stopServer(language) {
        try {
            if (!window.lspAPI) return false;
            const result = await window.lspAPI.stopServer(language);
            this._statusMap.set(language, LSP_SERVER_STATUS.STOPPED);
            this._notifyCallbacks(language, LSP_SERVER_STATUS.STOPPED);
            return result && result.success;
        } catch (e) {
            return false;
        }
    },

    _init() {
        if (window.lspAPI && window.lspAPI.onStatusChanged) {
            window.lspAPI.onStatusChanged((data) => {
                this._statusMap.set(data.language, data.status);
                this._notifyCallbacks(data.language, data.status);
            });
        }
    },
};

if (typeof window !== 'undefined') {
    window.LSP_SERVER_STATUS = LSP_SERVER_STATUS;
    window.LSPServerStatusManager = LSPServerStatusManager;
}