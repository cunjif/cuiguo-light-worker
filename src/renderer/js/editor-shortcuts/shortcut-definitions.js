/**
 * ==========================================================================
 * shortcut-definitions - 快捷键集中定义
 * ==========================================================================
 * 定义 ShortcutDefinition 结构与全部快捷键注册表。
 *
 * ShortcutDefinition 结构：
 *   - id: string                 唯一标识
 *   - keyCombo: { mainKey: string, modifiers: string[] }
 *       mainKey: 主键（如 's'、'Tab'、'/'、'+'、'='、'-'、'0'、'ArrowUp'）
 *       modifiers: 修饰键集合，枚举 'CtrlOrCmd' | 'Shift' | 'Alt'
 *   - action: string             动作名（saveActive/saveAll/closeActive/closeAll/
 *                               nextTab/prevTab/gotoTab/delegateMonaco/
 *                               zoomIn/zoomOut/zoomReset）
 *   - context: Array             上下文谓词集合（字符串或 { name, args }）
 *   - delegateTarget: string     Monaco 命令标识（仅 action === 'delegateMonaco' 时有效）
 *   - contextArgs: object        动作参数（如 gotoTab 的 n）
 *
 * 谓词格式：
 *   - 无参数：字符串 'hasActiveTab'
 *   - 有参数：{ name: 'tabCountGte', args: [2] }
 */

const SHORTCUT_DEFINITIONS = [
    // ----------------------------------------------------------------------
    // 保存类
    // ----------------------------------------------------------------------
    {
        id: 'save-active',
        keyCombo: { mainKey: 's', modifiers: ['CtrlOrCmd'] },
        action: 'saveActive',
        context: ['hasActiveTab', 'activeTabEditable'],
    },
    {
        id: 'save-all',
        keyCombo: { mainKey: 's', modifiers: ['CtrlOrCmd', 'Shift'] },
        action: 'saveAll',
        context: ['hasDirtyEditable'],
    },

    // ----------------------------------------------------------------------
    // 标签页切换/关闭
    // ----------------------------------------------------------------------
    {
        id: 'next-tab',
        keyCombo: { mainKey: 'Tab', modifiers: ['CtrlOrCmd'] },
        action: 'nextTab',
        context: [{ name: 'tabCountGte', args: [2] }],
    },
    {
        id: 'prev-tab',
        keyCombo: { mainKey: 'Tab', modifiers: ['CtrlOrCmd', 'Shift'] },
        action: 'prevTab',
        context: [{ name: 'tabCountGte', args: [2] }],
    },
    {
        id: 'goto-tab-1',
        keyCombo: { mainKey: '1', modifiers: ['Alt'] },
        action: 'gotoTab',
        context: ['hasActiveTab'],
        contextArgs: { n: 1 },
    },
    {
        id: 'goto-tab-2',
        keyCombo: { mainKey: '2', modifiers: ['Alt'] },
        action: 'gotoTab',
        context: ['hasActiveTab'],
        contextArgs: { n: 2 },
    },
    {
        id: 'goto-tab-3',
        keyCombo: { mainKey: '3', modifiers: ['Alt'] },
        action: 'gotoTab',
        context: ['hasActiveTab'],
        contextArgs: { n: 3 },
    },
    {
        id: 'goto-tab-4',
        keyCombo: { mainKey: '4', modifiers: ['Alt'] },
        action: 'gotoTab',
        context: ['hasActiveTab'],
        contextArgs: { n: 4 },
    },
    {
        id: 'goto-tab-5',
        keyCombo: { mainKey: '5', modifiers: ['Alt'] },
        action: 'gotoTab',
        context: ['hasActiveTab'],
        contextArgs: { n: 5 },
    },
    {
        id: 'goto-tab-6',
        keyCombo: { mainKey: '6', modifiers: ['Alt'] },
        action: 'gotoTab',
        context: ['hasActiveTab'],
        contextArgs: { n: 6 },
    },
    {
        id: 'goto-tab-7',
        keyCombo: { mainKey: '7', modifiers: ['Alt'] },
        action: 'gotoTab',
        context: ['hasActiveTab'],
        contextArgs: { n: 7 },
    },
    {
        id: 'goto-tab-8',
        keyCombo: { mainKey: '8', modifiers: ['Alt'] },
        action: 'gotoTab',
        context: ['hasActiveTab'],
        contextArgs: { n: 8 },
    },
    {
        id: 'goto-tab-9',
        keyCombo: { mainKey: '9', modifiers: ['Alt'] },
        action: 'gotoTab',
        context: ['hasActiveTab'],
        contextArgs: { n: 9 },
    },
    {
        id: 'close-active',
        keyCombo: { mainKey: 'w', modifiers: ['CtrlOrCmd'] },
        action: 'closeActive',
        context: ['hasActiveTab'],
    },
    {
        id: 'close-all',
        keyCombo: { mainKey: 'w', modifiers: ['CtrlOrCmd', 'Shift'] },
        action: 'closeAll',
        context: ['hasActiveTab'],
    },

    // ----------------------------------------------------------------------
    // 编辑类（委托 Monaco）
    // ----------------------------------------------------------------------
    {
        id: 'find',
        keyCombo: { mainKey: 'f', modifiers: ['CtrlOrCmd'] },
        action: 'delegateMonaco',
        context: ['editViewFocused'],
        delegateTarget: 'actions.find',
    },
    {
        id: 'replace',
        keyCombo: { mainKey: 'h', modifiers: ['CtrlOrCmd'] },
        action: 'delegateMonaco',
        context: ['editViewFocused'],
        delegateTarget: 'editor.action.startFindReplaceAction',
    },
    {
        id: 'undo',
        keyCombo: { mainKey: 'z', modifiers: ['CtrlOrCmd'] },
        action: 'delegateMonaco',
        context: ['editViewFocused'],
        delegateTarget: 'undo',
    },
    {
        id: 'redo',
        keyCombo: { mainKey: 'z', modifiers: ['CtrlOrCmd', 'Shift'] },
        action: 'delegateMonaco',
        context: ['editViewFocused'],
        delegateTarget: 'redo',
    },
    {
        id: 'redo-y',
        keyCombo: { mainKey: 'y', modifiers: ['CtrlOrCmd'] },
        action: 'delegateMonaco',
        context: ['editViewFocused'],
        delegateTarget: 'redo',
    },
    {
        id: 'comment-line',
        keyCombo: { mainKey: '/', modifiers: ['CtrlOrCmd'] },
        action: 'delegateMonaco',
        context: ['editViewFocused'],
        delegateTarget: 'editor.action.commentLine',
    },
    {
        id: 'move-line-up',
        keyCombo: { mainKey: 'ArrowUp', modifiers: ['Alt'] },
        action: 'delegateMonaco',
        context: ['editViewFocused'],
        delegateTarget: 'editor.action.moveLinesUpAction',
    },
    {
        id: 'move-line-down',
        keyCombo: { mainKey: 'ArrowDown', modifiers: ['Alt'] },
        action: 'delegateMonaco',
        context: ['editViewFocused'],
        delegateTarget: 'editor.action.moveLinesDownAction',
    },
    {
        id: 'delete-line',
        keyCombo: { mainKey: 'k', modifiers: ['CtrlOrCmd', 'Shift'] },
        action: 'delegateMonaco',
        context: ['editViewFocused'],
        delegateTarget: 'editor.action.deleteLines',
    },
    {
        id: 'format-document',
        keyCombo: { mainKey: 'i', modifiers: ['CtrlOrCmd', 'Shift'] },
        action: 'delegateMonaco',
        context: ['editViewFocused'],
        delegateTarget: 'editor.action.formatDocument',
    },
    {
        id: 'format-document-alt',
        keyCombo: { mainKey: 'f', modifiers: ['CtrlOrCmd', 'Alt'] },
        action: 'delegateMonaco',
        context: ['editViewFocused'],
        delegateTarget: 'editor.action.formatDocument',
    },

    // ----------------------------------------------------------------------
    // 视图缩放类
    // ----------------------------------------------------------------------
    {
        id: 'zoom-in-plus',
        keyCombo: { mainKey: '+', modifiers: ['CtrlOrCmd'] },
        action: 'zoomIn',
        context: ['panelFocused'],
    },
    {
        id: 'zoom-in-equal',
        keyCombo: { mainKey: '=', modifiers: ['CtrlOrCmd'] },
        action: 'zoomIn',
        context: ['panelFocused'],
    },
    {
        id: 'zoom-out',
        keyCombo: { mainKey: '-', modifiers: ['CtrlOrCmd'] },
        action: 'zoomOut',
        context: ['panelFocused'],
    },
    {
        id: 'zoom-reset',
        keyCombo: { mainKey: '0', modifiers: ['CtrlOrCmd'] },
        action: 'zoomReset',
        context: ['panelFocused'],
    },

    // ----------------------------------------------------------------------
    // 软换行类
    // ----------------------------------------------------------------------
    {
        id: 'toggle-soft-wrap',
        keyCombo: { mainKey: 'z', modifiers: ['Alt'] },
        action: 'toggleSoftWrap',
        context: ['editViewFocused'],
    },
];

if (typeof window !== 'undefined') {
    window.SHORTCUT_DEFINITIONS = SHORTCUT_DEFINITIONS;
}