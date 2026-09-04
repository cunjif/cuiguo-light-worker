/**
 * ==========================================================================
 * action-dispatcher - 快捷键动作分发
 * ==========================================================================
 * 依据 definition.action 路由至 Store action 或 MonacoDelegate。
 *
 * dispatchAction(definition, store)
 *   - definition: ShortcutDefinition
 *   - store: EditorTabStore
 *   - 返回: void | Promise<void>（异步动作如 save/close 返回 Promise）
 */

function dispatchAction(definition, store) {
    if (!definition || !store) return;
    const action = definition.action;
    switch (action) {
        case 'saveActive':
            return store.saveActive();
        case 'saveAll':
            return store.saveAll();
        case 'closeActive':
            if (store.activePath) return store.closeTab(store.activePath);
            return;
        case 'closeAll':
            return store.closeAll();
        case 'nextTab':
            return store.nextTab();
        case 'prevTab':
            return store.prevTab();
        case 'gotoTab': {
            const n = definition.contextArgs && definition.contextArgs.n;
            if (typeof n === 'number') return store.gotoTab(n);
            return;
        }
        case 'zoomIn':
            return store.zoomIn();
        case 'zoomOut':
            return store.zoomOut();
        case 'zoomReset':
            return store.zoomReset();
        case 'delegateMonaco': {
            const editor = store.activeEditor;
            if (!editor) return;
            return window.EditorShortcutsMonacoDelegate.triggerMonaco(definition.delegateTarget, editor);
        }
        default:
            console.debug('[EditorShortcuts] unknown action:', action);
            return;
    }
}

if (typeof window !== 'undefined') {
    window.EditorShortcutsActionDispatcher = { dispatchAction };
}