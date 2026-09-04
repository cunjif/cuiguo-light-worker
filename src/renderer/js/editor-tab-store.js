/**
 * ==========================================================================
 * EditorTabStore - 编辑器多标签页状态管理
 * ==========================================================================
 * 管理编辑器标签页列表、活动态、脏标记、视图状态、溢出状态、容量上限
 * 依赖：Pinia（全局 UMD）、window.workspaceAPI、useSettingStore、useSnackbarStore
 */

const EDITOR_TAB_CAPACITY_KEY = 'editor_tab_capacity';
const EDITOR_TAB_CAPACITY_DEFAULT = 20;
const EDITOR_TAB_CAPACITY_MIN = 1;
const EDITOR_TAB_CAPACITY_MAX = 50;

const EDITOR_FONT_SIZE_KEY = 'editor_font_size';
const ZoomStep = {
    minFontSize: 8,
    maxFontSize: 32,
    defaultFontSize: 14,
    step: 1,
};

const PREVIEW_EXTENSIONS = new Set(['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt']);

function getExt(name) {
    const parts = String(name || '').split('.');
    return parts.length > 1 ? '.' + parts.pop().toLowerCase() : '';
}

function previewViewMode(ext) {
    if (ext === '.pdf') return 'pdf';
    if (ext === '.docx' || ext === '.doc') return 'docx';
    if (ext === '.xlsx' || ext === '.xls') return 'xlsx';
    if (ext === '.pptx' || ext === '.ppt') return 'converted';
    return 'converted';
}

const useEditorTabStore = defineStore("editorTabStore", {
    state: () => ({
        /** @type {Array<{path:string,name:string,viewMode:string,dirty:boolean,readonly:boolean,scrollState:*,width:number}>} */
        tabs: [],
        /** @type {string|null} 活动标签页 path */
        activePath: null,
        /** @type {number} 标签页容量上限 */
        capacity: loadCapacity(),
        /** @type {number} 标签栏可视区宽度 */
        viewportWidth: 0,
        /** @type {number} 标签栏水平滚动偏移 */
        scrollOffset: 0,
        /** @type {boolean} 溢出菜单是否展开 */
        overflowMenuOpen: false,
        /** @type {Array<string>} 溢出标签页 path 列表 */
        overflowTabs: [],
        /** @type {boolean} 溢出按钮是否可见 */
        overflowButtonVisible: false,
        /** @type {Object|null} 待处理确认对话框 { type, title, message, options, resolve } */
        pendingConfirm: null,
        /** @type {Object<string, function>} 内容提供者 path -> () => string */
        contentProviders: {},
        /** @type {Object<string, function>} 视图状态提供者 path -> () => monacoState */
        viewStateProviders: {},
        /** @type {Object<string, *>} Monaco 编辑器实例注册表 path -> IStandaloneCodeEditor */
        editorInstances: {},
        /** @type {number} 代码编辑视图字号（受 ZoomStep 约束） */
        fontSize: loadFontSize(),
        /** @type {boolean} 面板级软换行开关（false=off/true=on），默认 off，不持久化 */
        softWrap: false,
    }),

    getters: {
        /** 活动标签页对象 */
        activeTab(state) {
            if (!state.activePath) return null;
            return state.tabs.find(t => t.path === state.activePath) || null;
        },
        /** 是否存在脏标签页 */
        hasDirty(state) {
            return state.tabs.some(t => t.dirty);
        },
        /** 标签栏总宽度 */
        totalWidth(state) {
            return state.tabs.reduce((sum, t) => sum + (t.width || 0), 0);
        },
        /** 最大滚动偏移 */
        maxOffset() {
            const extra = this.totalWidth - this.viewportWidth;
            return extra > 0 ? extra : 0;
        },
        /** 当前活动 path 对应的存活 Monaco 实例，无活动页或未注册时返回 null */
        activeEditor(state) {
            if (!state.activePath) return null;
            return state.editorInstances[state.activePath] || null;
        },
    },

    actions: {
        // ----------------------------------------------------------------------
        // 容量上限配置
        // ----------------------------------------------------------------------
        setCapacity(cap) {
            const n = Math.round(Number(cap));
            const clamped = Math.min(EDITOR_TAB_CAPACITY_MAX, Math.max(EDITOR_TAB_CAPACITY_MIN, isNaN(n) ? EDITOR_TAB_CAPACITY_DEFAULT : n));
            this.capacity = clamped;
            try { localStorage.setItem(EDITOR_TAB_CAPACITY_KEY, String(clamped)); } catch (e) {}
        },

        // ----------------------------------------------------------------------
        // 打开与切换
        // ----------------------------------------------------------------------
        async openTab(path) {
            if (!path) return { success: false, reason: 'readError' };
            const settingStore = useSettingStore();
            if (settingStore.functionTab !== 'workspace') return { success: false, reason: 'readError' };

            const existing = this.tabs.find(t => t.path === path);
            if (existing) {
                this.activateTab(path);
                console.log('[EditorTab] openTab reuse:', path);
                return { success: true };
            }

            if (this.tabs.length >= this.capacity) {
                console.warn('[EditorTab] openTab capacity reached:', this.tabs.length, '/', this.capacity);
                return { success: false, reason: 'capacity' };
            }

            const name = path.replace(/\\/g, '/').split('/').pop() || path;
            const ext = getExt(name);
            const isPreview = PREVIEW_EXTENSIONS.has(ext);
            const viewMode = isPreview ? previewViewMode(ext) : 'loading';

            this.tabs.push({
                path: path,
                name: name,
                viewMode: viewMode,
                dirty: false,
                readonly: isPreview,
                scrollState: null,
                width: 0,
            });
            this.activePath = path;
            console.log('[EditorTab] openTab new:', path, 'viewMode=', viewMode);
            return { success: true };
        },

        activateTab(path) {
            const tab = this.tabs.find(t => t.path === path);
            if (!tab) {
                console.warn('[EditorTab] activateTab path not found:', path);
                return;
            }
            if (this.activePath !== path) {
                this.activePath = path;
                console.log('[EditorTab] activateTab:', path);
            }
            if (this.overflowTabs.includes(path)) {
                this.scrollTabIntoView(path);
            }
        },

        nextTab() {
            if (this.tabs.length < 2) return;
            const idx = this.tabs.findIndex(t => t.path === this.activePath);
            if (idx < 0) return;
            const nextIdx = (idx + 1) % this.tabs.length;
            this.activateTab(this.tabs[nextIdx].path);
        },

        prevTab() {
            if (this.tabs.length < 2) return;
            const idx = this.tabs.findIndex(t => t.path === this.activePath);
            if (idx < 0) return;
            const prevIdx = (idx - 1 + this.tabs.length) % this.tabs.length;
            this.activateTab(this.tabs[prevIdx].path);
        },

        gotoTab(n) {
            const num = Math.round(Number(n));
            if (isNaN(num)) return;
            const idx = num - 1;
            if (idx < 0 || idx >= this.tabs.length) return;
            this.activateTab(this.tabs[idx].path);
        },

        scrollTabIntoView(path) {
            const tab = this.tabs.find(t => t.path === path);
            if (!tab || !tab.width) return;
            const idx = this.tabs.indexOf(tab);
            let leftEdge = 0;
            for (let i = 0; i < idx; i++) leftEdge += this.tabs[i].width || 0;
            const rightEdge = leftEdge + tab.width;
            if (leftEdge < this.scrollOffset) {
                this.setScrollOffset(leftEdge);
            } else if (rightEdge > this.scrollOffset + this.viewportWidth) {
                this.setScrollOffset(rightEdge - this.viewportWidth);
            }
        },

        // ----------------------------------------------------------------------
        // 关闭与活动态转移
        // ----------------------------------------------------------------------
        async closeTab(path) {
            const idx = this.tabs.findIndex(t => t.path === path);
            if (idx < 0) return;
            const tab = this.tabs[idx];

            if (tab.dirty) {
                const choice = await this.requestConfirm({
                    type: 'saveDiscardCancel',
                    titleKey: 'workspace.editor.closeConfirmTitle',
                    messageKey: 'workspace.editor.closeConfirmMessage',
                    name: tab.name,
                });
                if (choice === 'cancel') return;
                if (choice === 'save') {
                    const ok = await this._savePath(path);
                    if (!ok) return;
                }
            }

            this.tabs.splice(idx, 1);
            this._cleanupProviders(path);
            this._transferActive(idx);
            this.recalcOverflow();
            console.log('[EditorTab] closeTab:', path);
        },

        async closeOthers(keepPath) {
            const toClose = this.tabs.filter(t => t.path !== keepPath);
            for (const tab of toClose) {
                if (tab.dirty) {
                    const choice = await this.requestConfirm({
                        type: 'saveDiscardCancel',
                        titleKey: 'workspace.editor.closeConfirmTitle',
                        messageKey: 'workspace.editor.closeConfirmMessage',
                        name: tab.name,
                    });
                    if (choice === 'cancel') {
                        console.log('[EditorTab] closeOthers cancelled at:', tab.path);
                        return;
                    }
                    if (choice === 'save') {
                        const ok = await this._savePath(tab.path);
                        if (!ok) {
                            console.log('[EditorTab] closeOthers save failed at:', tab.path);
                            return;
                        }
                    }
                }
            }
            const keep = this.tabs.find(t => t.path === keepPath);
            this.tabs = keep ? [keep] : [];
            this.tabs.forEach(t => { if (t.path !== keepPath) this._cleanupProviders(t.path); });
            this.activePath = keepPath;
            this.recalcOverflow();
            console.log('[EditorTab] closeOthers keep:', keepPath);
        },

        async closeAll() {
            for (const tab of [...this.tabs]) {
                if (tab.dirty) {
                    const choice = await this.requestConfirm({
                        type: 'saveDiscardCancel',
                        titleKey: 'workspace.editor.closeConfirmTitle',
                        messageKey: 'workspace.editor.closeConfirmMessage',
                        name: tab.name,
                    });
                    if (choice === 'cancel') {
                        console.log('[EditorTab] closeAll cancelled at:', tab.path);
                        return;
                    }
                    if (choice === 'save') {
                        const ok = await this._savePath(tab.path);
                        if (!ok) {
                            console.log('[EditorTab] closeAll save failed at:', tab.path);
                            return;
                        }
                    }
                }
            }
            this.tabs.forEach(t => this._cleanupProviders(t.path));
            this.tabs = [];
            this.activePath = null;
            this.scrollOffset = 0;
            this.overflowMenuOpen = false;
            this.overflowTabs = [];
            this.overflowButtonVisible = false;
            console.log('[EditorTab] closeAll done');
        },

        _transferActive(closedIdx) {
            if (this.tabs.length === 0) {
                this.activePath = null;
                return;
            }
            const next = this.tabs[closedIdx] || this.tabs[closedIdx - 1] || null;
            this.activePath = next ? next.path : null;
            if (next && this.overflowTabs.includes(next.path)) {
                this.scrollTabIntoView(next.path);
            }
        },

        // ----------------------------------------------------------------------
        // 脏标记与视图状态
        // ----------------------------------------------------------------------
        setDirty(path, dirty) {
            const tab = this.tabs.find(t => t.path === path);
            if (!tab) return;
            if (tab.readonly) return;
            if (tab.dirty !== dirty) {
                tab.dirty = dirty;
            }
        },

        setViewMode(path, mode) {
            const tab = this.tabs.find(t => t.path === path);
            if (!tab) return;
            tab.viewMode = mode;
            if (mode === 'error') {
                tab.readonly = true;
            }
        },

        saveViewState(path, state) {
            const tab = this.tabs.find(t => t.path === path);
            if (tab) tab.scrollState = state;
        },

        getViewState(path) {
            const tab = this.tabs.find(t => t.path === path);
            return tab ? tab.scrollState : null;
        },

        registerContentProvider(path, fn) {
            this.contentProviders[path] = fn;
        },

        unregisterContentProvider(path) {
            delete this.contentProviders[path];
        },

        registerViewStateProvider(path, fn) {
            this.viewStateProviders[path] = fn;
        },

        unregisterViewStateProvider(path) {
            delete this.viewStateProviders[path];
        },

        _cleanupProviders(path) {
            delete this.contentProviders[path];
            delete this.viewStateProviders[path];
        },

        registerEditorInstance(path, editor) {
            if (!path) return;
            this.editorInstances[path] = editor;
        },

        unregisterEditorInstance(path) {
            if (!path) return;
            delete this.editorInstances[path];
        },

        // ----------------------------------------------------------------------
        // 保存
        // ----------------------------------------------------------------------
        async saveActive() {
            if (!this.activePath) return false;
            return this._savePath(this.activePath);
        },

        async saveAll() {
            const dirtyEditable = this.tabs.filter(t => t.dirty && !t.readonly && t.viewMode === 'edit');
            for (const tab of dirtyEditable) {
                const ok = await this._savePath(tab.path);
                if (!ok) {
                    const snackbar = useSnackbarStore();
                    snackbar.showErrorMessage('workspace.editor.saveFailed');
                    console.error('[EditorTab] saveAll failed at:', tab.path);
                    return;
                }
            }
        },

        async _savePath(path) {
            const tab = this.tabs.find(t => t.path === path);
            if (!tab || tab.viewMode !== 'edit') return false;

            const writeApproval = localStorage.getItem('write_approval') === 'true';
            if (!writeApproval) {
                const confirmed = await this.requestConfirm({
                    type: 'confirmCancel',
                    titleKey: 'workspace.editor.writeApprovalTitle',
                    messageKey: 'workspace.editor.writeApprovalMessage',
                });
                if (!confirmed) return false;
            }

            const provider = this.contentProviders[path];
            if (!provider) {
                console.error('[EditorTab] no content provider for:', path);
                return false;
            }
            const content = provider();
            try {
                const result = await window.workspaceAPI.writeFile(path, content);
                if (!result || !result.success) {
                    const snackbar = useSnackbarStore();
                    snackbar.showErrorMessage('workspace.editor.saveFailed');
                    console.error('[EditorTab] save failed:', path, result && result.error);
                    return false;
                }
                this.setDirty(path, false);
                console.log('[EditorTab] saved:', path);
                return true;
            } catch (err) {
                console.error('[EditorTab] save exception:', path, err);
                const snackbar = useSnackbarStore();
                snackbar.showErrorMessage('workspace.editor.saveFailed');
                return false;
            }
        },

        // ----------------------------------------------------------------------
        // 视图缩放
        // ----------------------------------------------------------------------
        _applyFontSize(editor) {
            if (editor) {
                try { editor.updateOptions({ fontSize: this.fontSize }); } catch (e) {}
            }
        },

        _persistFontSize() {
            try { localStorage.setItem(EDITOR_FONT_SIZE_KEY, String(this.fontSize)); } catch (e) {}
        },

        zoomIn() {
            if (this.fontSize >= ZoomStep.maxFontSize) return;
            this.fontSize = Math.min(ZoomStep.maxFontSize, this.fontSize + ZoomStep.step);
            this._applyFontSize(this.activeEditor);
            this._persistFontSize();
        },

        zoomOut() {
            if (this.fontSize <= ZoomStep.minFontSize) return;
            this.fontSize = Math.max(ZoomStep.minFontSize, this.fontSize - ZoomStep.step);
            this._applyFontSize(this.activeEditor);
            this._persistFontSize();
        },

        zoomReset() {
            if (this.fontSize === ZoomStep.defaultFontSize) return;
            this.fontSize = ZoomStep.defaultFontSize;
            this._applyFontSize(this.activeEditor);
            this._persistFontSize();
        },

        // ----------------------------------------------------------------------
        // 软换行（面板级，作用于全部存活代码编辑视图）
        // ----------------------------------------------------------------------
        _collectEditViews() {
            const views = [];
            for (const path of Object.keys(this.editorInstances)) {
                const tab = this.tabs.find(t => t.path === path);
                if (tab && tab.viewMode === 'edit') {
                    const editor = this.editorInstances[path];
                    if (editor) views.push(editor);
                }
            }
            return views;
        },

        _applySoftWrap(editor, wordWrap) {
            if (!editor) return false;
            try {
                editor.updateOptions({ wordWrap });
                return true;
            } catch (e) {
                console.debug('[EditorTab] applySoftWrap failed:', e);
                return false;
            }
        },

        toggleSoftWrap() {
            const prevWrap = this.softWrap;
            const views = this._collectEditViews();
            if (views.length === 0) {
                console.debug('[EditorTab] toggleSoftWrap aborted: no alive edit views');
                return;
            }
            this.softWrap = !prevWrap;
            const wordWrap = this.softWrap ? 'on' : 'off';
            let successCount = 0;
            let skipCount = 0;
            for (const editor of views) {
                if (this._applySoftWrap(editor, wordWrap)) {
                    successCount++;
                } else {
                    skipCount++;
                }
            }
            console.debug('[EditorTab] toggleSoftWrap:', prevWrap, '->', this.softWrap,
                'success:', successCount, 'skip:', skipCount);
        },

        // ----------------------------------------------------------------------
        // 溢出与滑动
        // ----------------------------------------------------------------------
        setTabWidth(path, width) {
            const tab = this.tabs.find(t => t.path === path);
            if (!tab) return;
            tab.width = Math.max(0, Number(width) || 0);
            this.recalcOverflow();
        },

        setViewportWidth(width) {
            this.viewportWidth = Math.max(0, Number(width) || 0);
            this.recalcOverflow();
        },

        setScrollOffset(offset) {
            if (this.maxOffset === 0) {
                this.scrollOffset = 0;
                return;
            }
            this.scrollOffset = Math.min(this.maxOffset, Math.max(0, Number(offset) || 0));
            this.recalcOverflow();
        },

        recalcOverflow() {
            const total = this.totalWidth;
            if (total > this.viewportWidth && this.viewportWidth > 0) {
                const maxOff = total - this.viewportWidth;
                if (this.scrollOffset > maxOff) this.scrollOffset = maxOff;
                if (this.scrollOffset < 0) this.scrollOffset = 0;
                const left = this.scrollOffset;
                const right = this.scrollOffset + this.viewportWidth;
                const overflow = [];
                let acc = 0;
                for (const tab of this.tabs) {
                    const tabLeft = acc;
                    const tabRight = acc + (tab.width || 0);
                    acc = tabRight;
                    if (tabRight <= left || tabLeft >= right) {
                        overflow.push(tab.path);
                    }
                }
                const changed = JSON.stringify(overflow) !== JSON.stringify(this.overflowTabs);
                this.overflowTabs = overflow;
                this.overflowButtonVisible = overflow.length > 0;
                if (overflow.length === 0 && this.overflowMenuOpen) {
                    this.overflowMenuOpen = false;
                }
                if (changed) console.log('[EditorTab] overflow recalc:', overflow.length, 'tabs hidden');
            } else {
                this.scrollOffset = 0;
                if (this.overflowTabs.length > 0) this.overflowTabs = [];
                this.overflowButtonVisible = false;
                if (this.overflowMenuOpen) this.overflowMenuOpen = false;
            }
        },

        toggleOverflowMenu(open) {
            if (!this.overflowButtonVisible) {
                this.overflowMenuOpen = false;
                return;
            }
            this.overflowMenuOpen = typeof open === 'boolean' ? open : !this.overflowMenuOpen;
        },

        // ----------------------------------------------------------------------
        // 确认对话框
        // ----------------------------------------------------------------------
        requestConfirm(config) {
            return new Promise((resolve) => {
                this.pendingConfirm = Object.assign({}, config, { resolve });
            });
        },

        resolveConfirm(result) {
            if (this.pendingConfirm && typeof this.pendingConfirm.resolve === 'function') {
                this.pendingConfirm.resolve(result);
            }
            this.pendingConfirm = null;
        },

        // ----------------------------------------------------------------------
        // 工作目录切换重置
        // ----------------------------------------------------------------------
        async resetOnWorkspaceSwitch() {
            if (this.hasDirty) {
                const confirmed = await this.requestConfirm({
                    type: 'confirmCancel',
                    titleKey: 'workspace.editor.workspaceSwitchTitle',
                    messageKey: 'workspace.editor.workspaceSwitchDirtyConfirm',
                });
                if (!confirmed) {
                    console.log('[EditorTab] workspace switch cancelled by user');
                    return false;
                }
            }
            this.tabs.forEach(t => this._cleanupProviders(t.path));
            this.tabs = [];
            this.activePath = null;
            this.scrollOffset = 0;
            this.overflowMenuOpen = false;
            this.overflowTabs = [];
            this.overflowButtonVisible = false;
            this.softWrap = false;
            console.log('[EditorTab] reset on workspace switch');
            return true;
        },
    },
});

function loadCapacity() {
    try {
        const raw = localStorage.getItem(EDITOR_TAB_CAPACITY_KEY);
        if (raw === null || raw === undefined) return EDITOR_TAB_CAPACITY_DEFAULT;
        const n = Math.round(Number(raw));
        if (isNaN(n)) return EDITOR_TAB_CAPACITY_DEFAULT;
        return Math.min(EDITOR_TAB_CAPACITY_MAX, Math.max(EDITOR_TAB_CAPACITY_MIN, n));
    } catch (e) {
        return EDITOR_TAB_CAPACITY_DEFAULT;
    }
}

function loadFontSize() {
    try {
        const raw = localStorage.getItem(EDITOR_FONT_SIZE_KEY);
        if (raw === null || raw === undefined) return ZoomStep.defaultFontSize;
        const n = Math.round(Number(raw));
        if (isNaN(n)) return ZoomStep.defaultFontSize;
        return Math.min(ZoomStep.maxFontSize, Math.max(ZoomStep.minFontSize, n));
    } catch (e) {
        return ZoomStep.defaultFontSize;
    }
}