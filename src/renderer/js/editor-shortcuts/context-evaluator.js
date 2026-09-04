/**
 * ==========================================================================
 * context-evaluator - 上下文谓词求值
 * ==========================================================================
 * 依据 EditorTabStore 当前状态求值上下文谓词集合。
 * 纯函数，仅读取 Store 状态，不产生副作用。
 *
 * 谓词格式：
 *   - 无参数：字符串 'hasActiveTab'
 *   - 有参数：{ name: 'tabCountGte', args: [2] }
 *
 * 谓词列表：
 *   - hasActiveTab:      activeTab !== null
 *   - activeTabEditable: activeTab && viewMode === 'edit' && !readonly
 *   - editViewFocused:   activeEditor 存在且其 DOM 含 document.activeElement
 *   - panelFocused:      面板根节点 contains(document.activeElement)
 *   - tabCountGte:n:     tabs.length >= n
 *   - hasDirtyEditable:  tabs.some(t => t.dirty && !t.readonly && t.viewMode === 'edit')
 */

function normalizePredicate(p) {
    if (typeof p === 'string') return { name: p, args: [] };
    if (p && typeof p === 'object') return { name: p.name, args: p.args || [] };
    return { name: '', args: [] };
}

function evaluatePredicate(pred, store, ctx) {
    const { name, args } = pred;
    switch (name) {
        case 'hasActiveTab':
            return store.activeTab !== null;
        case 'activeTabEditable': {
            const tab = store.activeTab;
            return !!tab && tab.viewMode === 'edit' && !tab.readonly;
        }
        case 'editViewFocused': {
            const editor = store.activeEditor;
            if (!editor) return false;
            try {
                const dom = editor.getDomNode();
                const active = document.activeElement;
                return !!dom && !!active && dom.contains(active);
            } catch (e) {
                return false;
            }
        }
        case 'panelFocused': {
            const root = ctx && ctx.panelRoot;
            if (!root) return false;
            try {
                const active = document.activeElement;
                return !!active && root.contains(active);
            } catch (e) {
                return false;
            }
        }
        case 'tabCountGte':
            return store.tabs.length >= (Number(args[0]) || 0);
        case 'hasDirtyEditable':
            return store.tabs.some(t => t.dirty && !t.readonly && t.viewMode === 'edit');
        default:
            return false;
    }
}

function evaluateContext(predicates, store, ctx) {
    if (!Array.isArray(predicates) || predicates.length === 0) return true;
    for (const p of predicates) {
        const pred = normalizePredicate(p);
        if (!evaluatePredicate(pred, store, ctx)) return false;
    }
    return true;
}

if (typeof window !== 'undefined') {
    window.EditorShortcutsContextEvaluator = { evaluateContext, evaluatePredicate };
}