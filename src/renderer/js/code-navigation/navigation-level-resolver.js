const NavigationLevelResolver = {
    resolve(language) {
        return window.getNavigationLevel(language);
    },

    resolveEffective(language) {
        if (window.LSPServerStatusManager &&
            window.LSPServerStatusManager.getStatus(language) === window.LSP_SERVER_STATUS.READY) {
            return window.LSP_ENHANCED;
        }
        return this.resolve(language);
    },
};

if (typeof window !== 'undefined') {
    window.NavigationLevelResolver = NavigationLevelResolver;
}