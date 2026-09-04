/**
 * ==========================================================================
 * monaco-delegate - Monaco 命令委托
 * ==========================================================================
 * 将 delegateTarget 映射为 Monaco 命令并触发。
 * 纯函数，无副作用（命令不存在或执行异常时静默处理）。
 *
 * 委托策略：
 *   - 内置命令（actions.find / undo / redo）：editor.trigger(source, handlerId, payload)
 *   - editor.action.* 类动作：editor.getAction(id)?.run()
 */

const BUILTIN_COMMANDS = new Set(['actions.find', 'undo', 'redo']);

function triggerMonaco(delegateTarget, editor) {
    if (!delegateTarget || !editor) return;
    try {
        if (BUILTIN_COMMANDS.has(delegateTarget)) {
            editor.trigger('editor-shortcuts', delegateTarget, null);
            return;
        }
        const action = editor.getAction(delegateTarget);
        if (action && typeof action.run === 'function') {
            action.run();
        }
    } catch (e) {
        console.debug('[EditorShortcuts] monaco delegate error:', delegateTarget, e);
    }
}

if (typeof window !== 'undefined') {
    window.EditorShortcutsMonacoDelegate = { triggerMonaco };
}