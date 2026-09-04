/**
 * ==========================================================================
 * EditorShortcuts - 编辑器面板键盘快捷键组件
 * ==========================================================================
 * 挂载于编辑器面板根节点，拦截 keydown 事件并分发至对应业务动作。
 * 不持有业务状态，仅持有快捷键定义表与命中判定逻辑。
 * 非命中事件原样放行，不阻塞既有链路。
 */

const EditorShortcuts = defineComponent({
    name: 'EditorShortcuts',
    template: `
    <div class="editor-shortcuts-root" ref="rootEl" style="display:contents;">
        <slot></slot>
    </div>
    `,
    setup() {
        const editorTabStore = useEditorTabStore();
        const rootEl = ref(null);

        function onKeydown(event) {
            const ctxSnapshot = {
                store: editorTabStore,
                panelRoot: rootEl.value,
            };
            const hit = window.EditorShortcutsKeyMatcher.matchShortcut(
                event,
                window.SHORTCUT_DEFINITIONS,
                ctxSnapshot
            );
            if (!hit) return;
            event.preventDefault();
            event.stopPropagation();
            console.debug('[EditorShortcuts] hit:', hit.id, 'action:', hit.action,
                'delegateTarget:', hit.delegateTarget || '-');
            try {
                const result = window.EditorShortcutsActionDispatcher.dispatchAction(hit, editorTabStore);
                if (result && typeof result.catch === 'function') {
                    result.catch(err => {
                        console.debug('[EditorShortcuts] action error:', hit.id, err);
                    });
                }
            } catch (err) {
                console.debug('[EditorShortcuts] action exception:', hit.id, err);
            }
        }

        onMounted(() => {
            if (rootEl.value) {
                rootEl.value.addEventListener('keydown', onKeydown);
            }
        });
        onUnmounted(() => {
            if (rootEl.value) {
                rootEl.value.removeEventListener('keydown', onKeydown);
            }
        });

        return { rootEl };
    },
});

if (typeof window !== 'undefined') {
    window.EditorShortcutsComponent = EditorShortcuts;
}