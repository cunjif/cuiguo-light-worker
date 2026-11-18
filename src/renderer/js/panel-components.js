/**
 * ==========================================================================
 * panel-components - 面板分隔条拖拽组件
 * ==========================================================================
 * PanelSplitter: 鼠标拖拽分隔条，实时调整左右面板占比百分比。
 *
 * Props:
 *   - orientation: 'horizontal' | 'vertical'（当前仅实现 horizontal）
 *   - ratio: number (0-100) 左侧面板占比
 *   - minRatio: number (默认 20)
 *   - maxRatio: number (默认 80)
 *   - disabled: boolean（过渡动画期间禁用）
 *
 * Emits:
 *   - update:ratio(number) 拖拽过程中实时触发
 *   - drag-end() 拖拽结束触发持久化
 */

const MIN_PANEL_WIDTH_PX = 240;

const PanelSplitter = defineComponent({
    name: 'PanelSplitter',
    props: {
        orientation: { type: String, default: 'horizontal' },
        ratio: { type: Number, required: true },
        minRatio: { type: Number, default: 20 },
        maxRatio: { type: Number, default: 80 },
        disabled: { type: Boolean, default: false },
    },
    emits: ['update:ratio', 'drag-end'],
    setup(props, { emit }) {
        const isDragging = ref(false);
        let rafId = null;
        let pendingRatio = null;

        function onMousedown(e) {
            if (props.disabled) return;
            e.preventDefault();
            isDragging.value = true;
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
            document.addEventListener('mousemove', onMousemove);
            document.addEventListener('mouseup', onMouseup);
        }

        function onMousemove(e) {
            if (!isDragging.value) return;
            const container = e.target.closest('.panel-split-container') ||
                document.querySelector('.panel-split-container');
            if (!container) return;
            const rect = container.getBoundingClientRect();
            let pct = ((e.clientX - rect.left) / rect.width) * 100;
            pct = Math.max(props.minRatio, Math.min(props.maxRatio, pct));
            const leftPx = (pct / 100) * rect.width;
            if (leftPx < MIN_PANEL_WIDTH_PX) {
                pct = (MIN_PANEL_WIDTH_PX / rect.width) * 100;
            }
            const rightPx = rect.width - leftPx;
            if (rightPx < MIN_PANEL_WIDTH_PX) {
                pct = 100 - (MIN_PANEL_WIDTH_PX / rect.width) * 100;
            }
            pendingRatio = pct;
            if (rafId === null) {
                rafId = requestAnimationFrame(() => {
                    rafId = null;
                    if (pendingRatio !== null) {
                        emit('update:ratio', pendingRatio);
                    }
                });
            }
        }

        function onMouseup() {
            if (!isDragging.value) return;
            isDragging.value = false;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', onMousemove);
            document.removeEventListener('mouseup', onMouseup);
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            emit('drag-end');
        }

        onUnmounted(() => {
            document.removeEventListener('mousemove', onMousemove);
            document.removeEventListener('mouseup', onMouseup);
            if (rafId !== null) cancelAnimationFrame(rafId);
        });

        return { isDragging, onMousedown };
    },
    template: `
    <div class="panel-splitter"
        :class="{ 'panel-splitter--dragging': isDragging, 'panel-splitter--disabled': disabled }"
        @mousedown="onMousedown">
        <div class="panel-splitter__handle"></div>
    </div>
    `,
});

if (typeof window !== 'undefined') {
    window.PanelSplitter = PanelSplitter;
}