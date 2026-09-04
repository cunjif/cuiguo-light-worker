/**
 * ==========================================================================
 * key-matcher - 快捷键命中判定
 * ==========================================================================
 * 将 KeyboardEvent 与注册表逐条匹配（主键、修饰键、平台），返回首个命中。
 * 纯函数，无副作用。
 *
 * matchShortcut(event, registry, ctxSnapshot)
 *   - event: KeyboardEvent
 *   - registry: ShortcutDefinition[]
 *   - ctxSnapshot: { store, panelRoot }
 *   - 返回: ShortcutDefinition | null
 */

function normalizeMainKey(key) {
    if (typeof key !== 'string') return '';
    if (key.length === 1) return key.toLowerCase();
    return key;
}

function matchMainKey(event, definition) {
    const defKey = normalizeMainKey(definition.keyCombo.mainKey);
    const evtKey = normalizeMainKey(event.key);
    return defKey === evtKey;
}

function matchModifiers(event, definition) {
    const modifiers = definition.keyCombo.modifiers || [];
    const modKeyName = window.EditorShortcutsPlatform.modifierKeyName();
    const requireCtrlOrCmd = modifiers.indexOf('CtrlOrCmd') >= 0;
    const requireShift = modifiers.indexOf('Shift') >= 0;
    const requireAlt = modifiers.indexOf('Alt') >= 0;
    if (requireCtrlOrCmd !== !!event[modKeyName]) return false;
    if (requireShift !== !!event.shiftKey) return false;
    if (requireAlt !== !!event.altKey) return false;
    return true;
}

function matchShortcut(event, registry, ctxSnapshot) {
    if (!event || !Array.isArray(registry)) return null;
    const store = ctxSnapshot && ctxSnapshot.store;
    const ctx = { panelRoot: ctxSnapshot && ctxSnapshot.panelRoot };
    for (const def of registry) {
        if (!def || !def.keyCombo) continue;
        if (!matchMainKey(event, def)) continue;
        if (!matchModifiers(event, def)) continue;
        if (!window.EditorShortcutsContextEvaluator.evaluateContext(def.context, store, ctx)) continue;
        return def;
    }
    return null;
}

if (typeof window !== 'undefined') {
    window.EditorShortcutsKeyMatcher = { matchShortcut, matchMainKey, matchModifiers };
}