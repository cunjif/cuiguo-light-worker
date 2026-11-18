const LSPBridge = {
    async sendRequest(language, method, params, timeoutMs = 500) {
        try {
            if (!window.lspAPI) return null;
            const result = await window.lspAPI.sendRequest(language, method, params, timeoutMs);
            return result;
        } catch (e) {
            return null;
        }
    },

    sendNotification(language, method, params) {
        try {
            if (!window.lspAPI) return;
            window.lspAPI.sendNotification(language, method, params);
        } catch (e) {
        }
    },

    isLanguageServerReady(language) {
        try {
            if (!window.lspAPI) return false;
            return window.LSPServerStatusManager.getStatus(language) === window.LSP_SERVER_STATUS.READY;
        } catch (e) {
            return false;
        }
    },
};

if (typeof window !== 'undefined') {
    window.LSPBridge = LSPBridge;
}