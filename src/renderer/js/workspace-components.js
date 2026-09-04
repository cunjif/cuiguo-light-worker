/**
 * ==========================================================================
 * Workspace 组件定义
 * ==========================================================================
 * 包含：InitWorkspaceDialog、WorkspaceSidebar、WorkspaceExplorer
 *       FileEditor、EditorTabItem、EditorTabBar、EditorConfirmDialog
 * 依赖：Vue（全局 UMD）、Vuetify、useWorkspaceStore、useSettingStore、useEditorTabStore
 */

// ==========================================================================
// InitWorkspaceDialog - 首次启动工作目录设置对话框
// ==========================================================================
const InitWorkspaceDialog = defineComponent({
    name: 'InitWorkspaceDialog',
    template: `
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)"
        persistent max-width="520" no-click-animation>
        <v-card>
            <v-card-title class="text-h6 d-flex align-center">
                <v-icon class="mr-2">mdi-folder-plus</v-icon>
                {{ $t('workspace.init.title') }}
            </v-card-title>
            <v-card-text>
                <p class="text-body-2 mb-4">{{ $t('workspace.init.description') }}</p>
                <v-text-field
                    v-model="selectedPath"
                    :label="$t('workspace.init.pathLabel')"
                    readonly
                    prepend-inner-icon="mdi-folder"
                    :error-messages="errorMessage"
                    density="compact"
                    variant="outlined">
                    <template v-slot:append-inner>
                        <v-btn icon size="small" variant="text" @click="browseDirectory">
                            <v-icon>mdi-folder-open</v-icon>
                        </v-btn>
                    </template>
                </v-text-field>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="cancel">{{ $t('workspace.init.cancel') }}</v-btn>
                <v-btn color="primary" variant="flat" @click="confirm" :loading="creating">
                    {{ $t('workspace.init.confirm') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
    `,
    props: {
        modelValue: { type: Boolean, default: false },
    },
    emits: ['update:modelValue', 'created'],
    setup(props, { emit }) {
        const selectedPath = ref('');
        const errorMessage = ref('');
        const creating = ref(false);
        const workspaceStore = useWorkspaceStore();

        onMounted(async () => {
            const defaultPath = await workspaceStore.getDefaultPath();
            selectedPath.value = defaultPath;
        });

        async function browseDirectory() {
            const dir = await workspaceStore.chooseDirectory();
            if (dir) {
                selectedPath.value = dir;
                errorMessage.value = '';
            }
        }

        async function confirm() {
            errorMessage.value = '';
            const validation = await window.workspaceAPI.validatePath(selectedPath.value);
            if (!validation.ok) {
                errorMessage.value = validation.reason || 'Invalid path';
                return;
            }

            creating.value = true;
            try {
                const name = selectedPath.value.replace(/\\\\/g, '/').split('/').pop() || 'workspace';
                const result = await workspaceStore.create(name, selectedPath.value);
                if (result.success) {
                    emit('created', result.workspace);
                    emit('update:modelValue', false);
                } else {
                    errorMessage.value = result.error || 'Failed to create workspace';
                }
            } finally {
                creating.value = false;
            }
        }

        async function cancel() {
            errorMessage.value = '';
            creating.value = true;
            try {
                const defaultPath = await workspaceStore.getDefaultPath();
                const name = defaultPath.replace(/\\\\/g, '/').split('/').pop() || 'workspace';
                await workspaceStore.create(name, defaultPath);
                emit('update:modelValue', false);
            } finally {
                creating.value = false;
            }
        }

        return { selectedPath, errorMessage, creating, browseDirectory, confirm, cancel };
    },
});

// ==========================================================================
// WorkspaceSidebar - 导航侧边栏
// ==========================================================================
const WorkspaceSidebar = defineComponent({
    name: 'WorkspaceSidebar',
    template: `
    <div class="workspace-sidebar" :class="sidebarClass">
        <v-btn
            :icon="true"
            :variant="settingStore.functionTab === 'function' ? 'flat' : 'text'"
            :color="settingStore.functionTab === 'function' ? 'primary' : 'default'"
            size="small"
            @click="settingStore.setFunctionTab('function')"
            :title="$t('workspace.sidebar.functionTab')">
            <v-icon>mdi-view-dashboard</v-icon>
        </v-btn>
        <v-btn
            :icon="true"
            :variant="settingStore.functionTab === 'workspace' ? 'flat' : 'text'"
            :color="settingStore.functionTab === 'workspace' ? 'primary' : 'default'"
            size="small"
            @click="settingStore.setFunctionTab('workspace')"
            :title="$t('workspace.sidebar.workspaceTab')">
            <v-icon>mdi-folder</v-icon>
        </v-btn>
    </div>
    `,
    setup() {
        const settingStore = useSettingStore();

        const sidebarClass = computed(() => {
            const side = settingStore.activePanel === 'chat' ? 'right' : 'left';
            return {
                'workspace-sidebar--right': side === 'right',
                'workspace-sidebar--left': side === 'left',
                'workspace-sidebar--collapsed': settingStore.sidebarCollapsed,
            };
        });

        return { settingStore, sidebarClass };
    },
});

// ==========================================================================
// WorkspaceExplorer - 工作目录文件树浏览器
// ==========================================================================
const WorkspaceExplorer = defineComponent({
    name: 'WorkspaceExplorer',
    template: `
    <div class="workspace-explorer d-flex flex-column" style="height:100%;">
        <div class="workspace-explorer-header d-flex align-center px-3 py-2">
            <v-icon size="small" class="mr-2">mdi-folder</v-icon>
            <span class="text-body-2 text-truncate" style="min-width:0;">
                {{ activeWorkspace ? activeWorkspace.name : $t('workspace.explorer.noWorkspace') }}
            </span>
            <v-spacer></v-spacer>
            <v-btn icon size="x-small" variant="text" @click="switchWorkspace"
                :loading="workspaceStore.switching"
                :title="$t('workspace.explorer.switch')">
                <v-icon>mdi-folder-swap</v-icon>
            </v-btn>
        </div>
        <div class="workspace-explorer-path px-3 py-1 text-caption text-grey" v-if="activeWorkspace">
            {{ pathDisplay }}
        </div>
        <v-divider></v-divider>
        <div class="workspace-explorer-tree flex-grow-1 overflow-y-auto" v-if="activeWorkspace">
            <v-treeview
                :items="treeItems"
                :load-children="loadChildren"
                item-title="name"
                item-value="path"
                item-children="children"
                density="compact"
                activatable
                @update:active="onActiveChange">
                <template v-slot:prepend="{ item }">
                    <v-icon size="small" @click.stop="onItemClick(item)" style="cursor:pointer;">
                        {{ item.isDir ? 'mdi-folder' : getFileIcon(item.name) }}
                    </v-icon>
                </template>
                <template v-slot:title="{ item }">
                    <span @click.stop="onItemClick(item)" style="cursor:pointer;">{{ item.name }}</span>
                </template>
            </v-treeview>
        </div>
        <div class="d-flex align-center justify-center flex-grow-1 text-grey" v-else>
            <span class="text-body-2">{{ $t('workspace.explorer.noWorkspace') }}</span>
        </div>
        <v-overlay :model-value="workspaceStore.switching" contained class="align-center justify-center">
            <v-progress-circular indeterminate size="32"></v-progress-circular>
        </v-overlay>
    </div>
    `,
    emits: ['file-select'],
    setup(props, { emit }) {
        const workspaceStore = useWorkspaceStore();
        const treeItems = ref([]);

        const activeWorkspace = computed(() => workspaceStore.activeWorkspace);

        const pathDisplay = computed(() => {
            if (!activeWorkspace.value) return '';
            const p = activeWorkspace.value.path;
            return p.length > 40 ? p.substring(0, 15) + '...' + p.substring(p.length - 20) : p;
        });

        async function loadChildren(parent) {
            if (!parent || !parent.isDir) return;
            try {
                const items = await window.workspaceAPI.listDir(parent.path);
                parent.children = items.map(item => ({
                    name: item.name,
                    path: item.path,
                    isDir: item.isDir,
                    children: item.isDir ? [] : undefined,
                }));
            } catch (err) {
                console.error('Failed to load directory:', err);
            }
        }

        async function loadRoot() {
            if (!activeWorkspace.value) {
                treeItems.value = [];
                return;
            }
            try {
                const items = await window.workspaceAPI.listDir(activeWorkspace.value.path);
                treeItems.value = items.map(item => ({
                    name: item.name,
                    path: item.path,
                    isDir: item.isDir,
                    children: item.isDir ? [] : undefined,
                }));
            } catch (err) {
                console.error('Failed to load root:', err);
                treeItems.value = [];
            }
        }

        function findInTree(items, path) {
            for (const item of items) {
                if (item.path === path) return item;
                if (item.children) {
                    const found = findInTree(item.children, path);
                    if (found) return found;
                }
            }
            return null;
        }

        function onItemClick(item) {
            if (item && !item.isDir) {
                emit('file-select', item.path);
            }
        }

        function onActiveChange(active) {
            if (!active || active.length === 0) return;
            const val = active[0];
            if (typeof val === 'string') {
                const item = findInTree(treeItems.value, val);
                if (item && !item.isDir) {
                    emit('file-select', val);
                }
            } else if (val && val.path && !val.isDir) {
                emit('file-select', val.path);
            }
        }

        function getFileIcon(name) {
            const ext = name.split('.').pop()?.toLowerCase();
            const iconMap = {
                'js': 'mdi-language-javascript',
                'ts': 'mdi-language-typescript',
                'json': 'mdi-code-json',
                'md': 'mdi-language-markdown',
                'html': 'mdi-language-html5',
                'css': 'mdi-language-css3',
                'py': 'mdi-language-python',
                'yaml': 'mdi-file-document',
                'yml': 'mdi-file-document',
                'txt': 'mdi-file-document',
                'pdf': 'mdi-file-pdf',
                'png': 'mdi-file-image',
                'jpg': 'mdi-file-image',
                'jpeg': 'mdi-file-image',
                'gif': 'mdi-file-image',
            };
            return iconMap[ext] || 'mdi-file';
        }

        async function switchWorkspace() {
            const dir = await workspaceStore.chooseDirectory();
            if (!dir) return;

            const editorTabStore = useEditorTabStore();
            const result = await workspaceStore.switchTo(dir, undefined,
                async () => {
                    const ok = await editorTabStore.resetOnWorkspaceSwitch();
                    if (!ok) throw new Error('User cancelled workspace switch');
                    if (window.workspaceAPI.awaitDrain) {
                        await window.workspaceAPI.awaitDrain();
                    }
                },
                async (newPath) => {
                    if (window.workspaceAPI.rebuildFilesystem) {
                        await window.workspaceAPI.rebuildFilesystem(newPath);
                    }
                }
            );

            if (!result.success) {
                console.error('Switch workspace failed:', result.error);
            }
            await loadRoot();
        }

        watch(activeWorkspace, () => {
            loadRoot();
        }, { immediate: true });

        return {
            workspaceStore, activeWorkspace, pathDisplay, treeItems,
            loadChildren, onItemClick, onActiveChange, getFileIcon, switchWorkspace,
        };
    },
});

// ==========================================================================
// FileEditor - 文件编辑器内容区（Monaco 编辑 + 原格式预览：PDF/DOCX/XLSX）
// 由 EditorTabStore 驱动，不再接收 filePath prop
// ==========================================================================
const FileEditor = defineComponent({
    name: 'FileEditor',
    template: `
    <div class="file-editor d-flex flex-column" style="height:100%;">
        <div class="d-flex align-center justify-center flex-grow-1 text-grey" v-if="!activePath">
            <div class="text-center">
                <v-icon size="48" class="mb-2">mdi-file-search</v-icon>
                <div class="text-body-2">{{ $t('workspace.editor.selectHint') }}</div>
            </div>
        </div>
        <div class="file-editor-body flex-grow-1" ref="editorContainer"
            v-else-if="viewMode === 'edit'"></div>
        <div class="file-editor-preview flex-grow-1 overflow-y-auto"
            v-else-if="viewMode === 'pdf'">
            <div class="d-flex justify-center flex-column align-center pa-2" ref="pdfContainer"></div>
        </div>
        <div class="file-editor-preview flex-grow-1 overflow-y-auto pa-3 docx-preview-wrapper"
            v-else-if="viewMode === 'docx'"
            ref="docxContainer"></div>
        <div class="file-editor-preview flex-grow-1 overflow-auto pa-3"
            v-else-if="viewMode === 'xlsx'"
            v-html="previewContent"></div>
        <div class="file-editor-preview flex-grow-1 overflow-y-auto pa-3"
            v-else-if="viewMode === 'converted'">
            <md-preview :modelValue="previewContent"></md-preview>
        </div>
        <div class="d-flex align-center justify-center flex-grow-1 text-grey" v-else>
            <span class="text-body-2">{{ previewContent || $t('workspace.editor.binaryFile') }}</span>
        </div>
        <v-snackbar v-model="showError" color="error" :timeout="3000">
            {{ errorMessage }}
        </v-snackbar>
    </div>
    `,
    setup() {
        const editorTabStore = useEditorTabStore();
        const editorContainer = ref(null);
        const pdfContainer = ref(null);
        const docxContainer = ref(null);
        const activePath = computed(() => editorTabStore.activePath);
        const activeTab = computed(() => editorTabStore.activeTab);
        const fileName = computed(() => activePath.value ? activePath.value.replace(/\\/g, '/').split('/').pop() || '' : '');
        const viewMode = ref('loading');
        const previewContent = ref('');
        const saving = ref(false);
        const showError = ref(false);
        const errorMessage = ref('');
        let editor = null;
        let editorDisposables = [];
        let pdfDoc = null;
        let pdfRenderVersion = 0;
        let pdfRenderTasks = [];
        let currentLoadedPath = null;

        const ext = computed(() => {
            const parts = fileName.value.split('.');
            return parts.length > 1 ? '.' + parts.pop().toLowerCase() : '';
        });

        function getFileIcon(name) {
            const e = name.split('.').pop()?.toLowerCase();
            const iconMap = {
                'js': 'mdi-language-javascript', 'ts': 'mdi-language-typescript',
                'json': 'mdi-code-json', 'md': 'mdi-language-markdown',
                'html': 'mdi-language-html5', 'css': 'mdi-language-css3',
                'py': 'mdi-language-python', 'pdf': 'mdi-file-pdf',
                'doc': 'mdi-file-word', 'docx': 'mdi-file-word',
                'xls': 'mdi-file-excel', 'xlsx': 'mdi-file-excel',
                'ppt': 'mdi-file-powerpoint', 'pptx': 'mdi-file-powerpoint',
                'png': 'mdi-file-image', 'jpg': 'mdi-file-image',
            };
            return iconMap[e] || 'mdi-file';
        }

        function getLanguage(filePath) {
            const e = filePath.split('.').pop()?.toLowerCase();
            const langMap = {
                'js': 'javascript', 'ts': 'typescript', 'json': 'json',
                'md': 'markdown', 'html': 'html', 'css': 'css',
                'py': 'python', 'yaml': 'yaml', 'yml': 'yaml',
                'xml': 'xml', 'sh': 'shell', 'txt': 'plaintext',
            };
            return langMap[e] || 'plaintext';
        }

        function cleanupEditor() {
            editorDisposables.forEach(d => { try { d.dispose(); } catch (e) {} });
            editorDisposables = [];
            if (editor) {
                if (currentLoadedPath) editorTabStore.unregisterEditorInstance(currentLoadedPath);
                editor.dispose();
                editor = null;
            }
        }

        function cleanup() {
            cleanupEditor();
            pdfRenderVersion++;
            pdfRenderTasks.forEach(t => { try { t.cancel(); } catch (e) {} });
            pdfRenderTasks = [];
            if (pdfDoc) { try { pdfDoc.destroy(); } catch (e) {} pdfDoc = null; }
        }

        // ---------- PDF：pdf.js 原格式 canvas 渲染 ----------
        async function renderPdf(data) {
            if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js not loaded');
            if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = '../lib/js/pdf.worker.min.js';
            }
            const myVersion = pdfRenderVersion;
            const loadingTask = pdfjsLib.getDocument({ data });
            pdfDoc = await loadingTask.promise;
            if (myVersion !== pdfRenderVersion) return;
            await nextTick();
            if (myVersion !== pdfRenderVersion) return;
            const container = pdfContainer.value;
            if (!container) return;
            container.innerHTML = '';
            for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                if (myVersion !== pdfRenderVersion) return;
                const page = await pdfDoc.getPage(pageNum);
                if (myVersion !== pdfRenderVersion) return;
                const baseViewport = page.getViewport({ scale: 1 });
                const scale = Math.min(1.5, Math.max(0.8, (container.clientWidth - 24) / baseViewport.width));
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.className = 'pdf-page-canvas mb-3 elevation-1';
                container.appendChild(canvas);
                const renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport });
                pdfRenderTasks.push(renderTask);
                try {
                    await renderTask.promise;
                } catch (err) {
                    if (err && (err.name === 'RenderingCancelledException' || /^Rendering cancelled/.test(err.message || ''))) {
                        return;
                    }
                    throw err;
                } finally {
                    const idx = pdfRenderTasks.indexOf(renderTask);
                    if (idx >= 0) pdfRenderTasks.splice(idx, 1);
                }
            }
        }

        // ---------- DOCX：docx-preview 原格式渲染 ----------
        async function renderDocx(data) {
            if (typeof docx === 'undefined' || typeof docx.renderAsync !== 'function') {
                throw new Error('docx-preview not loaded');
            }
            viewMode.value = 'docx';
            editorTabStore.setViewMode(currentLoadedPath, 'docx');
            await nextTick();
            if (docxContainer.value) {
                docxContainer.value.innerHTML = '';
                await docx.renderAsync(data, docxContainer.value, null, {
                    inWrapper: true,
                    ignoreWidth: false,
                    ignoreHeight: false,
                    breakPages: true,
                });
            }
        }

        // ---------- XLSX：SheetJS 渲染表格 ----------
        async function renderXlsx(data) {
            if (typeof XLSX === 'undefined') throw new Error('SheetJS not loaded');
            const workbook = XLSX.read(data, { type: 'array' });
            let html = '';
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                html += `<div class="text-subtitle-2 mt-2 mb-1">${sheetName}</div>`;
                html += XLSX.utils.sheet_to_html(sheet, { editable: false });
            }
            previewContent.value = html;
            viewMode.value = 'xlsx';
            editorTabStore.setViewMode(currentLoadedPath, 'xlsx');
        }

        // ---------- PPT 等无原生渲染能力：markitdown 转换回退 ----------
        async function renderConverted() {
            const previewResult = await window.workspaceAPI.previewFile(currentLoadedPath);
            viewMode.value = 'converted';
            if (previewResult.success && previewResult.markdown) {
                previewContent.value = previewResult.markdown;
                editorTabStore.setViewMode(currentLoadedPath, 'converted');
            } else {
                previewContent.value = 'Preview failed: ' + (previewResult.error || 'Unknown error');
                viewMode.value = 'error';
                editorTabStore.setViewMode(currentLoadedPath, 'error');
            }
        }

        async function loadFile() {
            const path = activePath.value;
            cleanup();
            previewContent.value = '';

            if (!path) {
                viewMode.value = 'empty';
                currentLoadedPath = null;
                return;
            }

            currentLoadedPath = path;
            viewMode.value = 'loading';

            const e = ext.value;
            try {
                if (e === '.pdf' || e === '.docx' || e === '.xlsx' || e === '.xls' || e === '.pptx' || e === '.ppt') {
                    const binResult = await window.workspaceAPI.readFileBinary(path);
                    if (!binResult.success || !binResult.data) {
                        errorMessage.value = binResult.error || 'Failed to read file';
                        showError.value = true;
                        viewMode.value = 'error';
                        editorTabStore.setViewMode(path, 'error');
                        return;
                    }
                    const data = binResult.data;
                    if (e === '.pdf') {
                        viewMode.value = 'pdf';
                        editorTabStore.setViewMode(path, 'pdf');
                        await renderPdf(data);
                    } else if (e === '.docx') {
                        await renderDocx(data);
                    } else if (e === '.xlsx' || e === '.xls') {
                        await renderXlsx(data);
                    } else {
                        await renderConverted();
                    }
                    return;
                }

                const result = await window.workspaceAPI.readFile(path);
                if (!result.success) {
                    errorMessage.value = result.error || 'Failed to read file';
                    showError.value = true;
                    viewMode.value = 'error';
                    editorTabStore.setViewMode(path, 'error');
                    return;
                }

                if (result.isBinary) {
                    viewMode.value = 'binary';
                    editorTabStore.setViewMode(path, 'binary');
                    return;
                }

                viewMode.value = 'edit';
                editorTabStore.setViewMode(path, 'edit');
                await nextTick();
                if (editorContainer.value && window.require) {
                    window.require(['vs/editor/editor.main'], () => {
                        if (!editorContainer.value || currentLoadedPath !== path) return;
                        editor = monaco.editor.create(editorContainer.value, {
                            value: result.content,
                            language: getLanguage(path),
                            theme: 'vs',
                            automaticLayout: true,
                            fontSize: editorTabStore.fontSize,
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                        });
                        editorTabStore.registerEditorInstance(path, editor);
                        editorTabStore.registerContentProvider(path, () => editor ? editor.getValue() : '');
                        editorTabStore.registerViewStateProvider(path, () => editor ? editor.saveViewState() : null);
                        editorDisposables.push(editor.onDidChangeModelContent(() => {
                            editorTabStore.setDirty(path, true);
                        }));
                        const savedState = editorTabStore.getViewState(path);
                        if (savedState) {
                            try { editor.restoreViewState(savedState); } catch (e) {}
                        }
                    });
                }
            } catch (err) {
                console.error('File load error:', err);
                errorMessage.value = String(err);
                showError.value = true;
                viewMode.value = 'error';
                editorTabStore.setViewMode(path, 'error');
                previewContent.value = 'Failed to load file: ' + String(err);
            }
        }

        async function save() {
            saving.value = true;
            try {
                await editorTabStore.saveActive();
            } finally {
                saving.value = false;
            }
        }

        onMounted(() => loadFile());
        onUnmounted(() => {
            if (currentLoadedPath) {
                editorTabStore.unregisterContentProvider(currentLoadedPath);
                editorTabStore.unregisterViewStateProvider(currentLoadedPath);
            }
            cleanup();
        });
        watch(activePath, (newPath, oldPath) => {
            if (oldPath && editor) {
                try { editorTabStore.saveViewState(oldPath, editor.saveViewState()); } catch (e) {}
            }
            if (oldPath) {
                editorTabStore.unregisterContentProvider(oldPath);
                editorTabStore.unregisterViewStateProvider(oldPath);
            }
            loadFile();
        });
        watch(() => editorTabStore.fontSize, (newSize) => {
            if (viewMode.value === 'edit' && editor) {
                try { editor.updateOptions({ fontSize: newSize }); } catch (e) {}
            }
        });

        return {
            editorContainer, pdfContainer, docxContainer,
            activePath, fileName, viewMode, previewContent,
            saving, showError, errorMessage, getFileIcon, save,
        };
    },
});

// ==========================================================================
// EditorTabItem - 单个标签页项
// ==========================================================================
const EditorTabItem = defineComponent({
    name: 'EditorTabItem',
    template: `
    <div class="editor-tab-item d-inline-flex align-center px-2 py-1"
        :class="{ 'editor-tab-item--active': tab.active, 'editor-tab-item--dirty': tab.dirty }"
        @click="onClick"
        @click.middle.prevent="onClose"
        @contextmenu.prevent="onContextMenu">
        <v-icon size="x-small" class="mr-1">{{ icon }}</v-icon>
        <span class="text-caption text-truncate" style="max-width:120px;min-width:0;">{{ tab.name }}</span>
        <v-icon v-if="tab.dirty" size="x-small" class="ml-1" color="warning">mdi-circle-small</v-icon>
        <v-btn icon size="x-small" variant="text" class="ml-1"
            @click.stop="onClose" :title="$t('workspace.editor.close')">
            <v-icon size="x-small">mdi-close</v-icon>
        </v-btn>
    </div>
    `,
    props: {
        tab: { type: Object, required: true },
    },
    setup(props, { emit }) {
        const editorTabStore = useEditorTabStore();

        function getFileIcon(name) {
            const e = name.split('.').pop()?.toLowerCase();
            const iconMap = {
                'js': 'mdi-language-javascript', 'ts': 'mdi-language-typescript',
                'json': 'mdi-code-json', 'md': 'mdi-language-markdown',
                'html': 'mdi-language-html5', 'css': 'mdi-language-css3',
                'py': 'mdi-language-python', 'pdf': 'mdi-file-pdf',
                'doc': 'mdi-file-word', 'docx': 'mdi-file-word',
                'xls': 'mdi-file-excel', 'xlsx': 'mdi-file-excel',
                'ppt': 'mdi-file-powerpoint', 'pptx': 'mdi-file-powerpoint',
                'png': 'mdi-file-image', 'jpg': 'mdi-file-image',
            };
            return iconMap[e] || 'mdi-file';
        }

        const icon = computed(() => getFileIcon(props.tab.name));

        function onClick() {
            editorTabStore.activateTab(props.tab.path);
        }

        function onClose() {
            editorTabStore.closeTab(props.tab.path);
        }

        function onContextMenu() {
            emit('contextmenu', props.tab.path);
        }

        return { icon, onClick, onClose, onContextMenu };
    },
});

// ==========================================================================
// EditorTabBar - 标签栏（滑动 + 溢出按钮 + 溢出菜单）
// ==========================================================================
const EditorTabBar = defineComponent({
    name: 'EditorTabBar',
    components: { 'editor-tab-item': EditorTabItem },
    template: `
    <div class="editor-tab-bar d-flex align-center" ref="barContainer" v-if="tabs.length > 0">
        <div class="editor-tab-bar-scroll flex-grow-1 overflow-hidden" ref="scrollContainer"
            @wheel.prevent="onWheel"
            @mousedown="onDragStart"
            @mousemove="onDragMove"
            @mouseup="onDragEnd"
            @mouseleave="onDragEnd">
            <div class="editor-tab-bar-track d-inline-flex" :style="trackStyle">
                <editor-tab-item v-for="tab in tabs" :key="tab.path"
                    :tab="tab" @contextmenu="onItemContextMenu"></editor-tab-item>
            </div>
        </div>
        <v-menu :model-value="editorTabStore.overflowMenuOpen"
            @update:model-value="editorTabStore.toggleOverflowMenu($event)"
            v-if="editorTabStore.overflowButtonVisible">
            <template v-slot:activator="{ props: menuProps }">
                <v-btn icon size="x-small" variant="text" v-bind="menuProps"
                    :title="$t('workspace.editor.overflowMenu')">
                    <v-icon>mdi-chevron-down</v-icon>
                </v-btn>
            </template>
            <v-list density="compact">
                <v-list-item v-for="path in editorTabStore.overflowTabs" :key="path"
                    @click="editorTabStore.activateTab(path); editorTabStore.toggleOverflowMenu(false)">
                    <template v-slot:prepend>
                        <v-icon size="x-small">{{ getOverflowIcon(path) }}</v-icon>
                    </template>
                    <v-list-item-title class="text-caption">{{ getOverflowName(path) }}</v-list-item-title>
                    <template v-slot:append>
                        <v-icon v-if="isOverflowDirty(path)" size="x-small" color="warning">mdi-circle-small</v-icon>
                    </template>
                </v-list-item>
            </v-list>
        </v-menu>
    </div>
    `,
    setup() {
        const editorTabStore = useEditorTabStore();
        const barContainer = ref(null);
        const scrollContainer = ref(null);
        let resizeObserver = null;
        let isDragging = false;
        let dragStartX = 0;
        let dragStartOffset = 0;

        const tabs = computed(() => editorTabStore.tabs);
        const trackStyle = computed(() => ({
            transform: 'translateX(' + (-editorTabStore.scrollOffset) + 'px)',
        }));

        function onWheel(e) {
            if (editorTabStore.maxOffset === 0) return;
            editorTabStore.setScrollOffset(editorTabStore.scrollOffset + (e.deltaY || e.deltaX));
        }

        function onDragStart(e) {
            isDragging = true;
            dragStartX = e.clientX;
            dragStartOffset = editorTabStore.scrollOffset;
        }

        function onDragMove(e) {
            if (!isDragging) return;
            const delta = dragStartX - e.clientX;
            editorTabStore.setScrollOffset(dragStartOffset + delta);
        }

        function onDragEnd() {
            isDragging = false;
        }

        function onItemContextMenu(path) {
            editorTabStore.activateTab(path);
        }

        function getOverflowName(path) {
            const t = editorTabStore.tabs.find(t => t.path === path);
            return t ? t.name : path;
        }

        function getOverflowIcon(path) {
            const t = editorTabStore.tabs.find(t => t.path === path);
            if (!t) return 'mdi-file';
            const e = t.name.split('.').pop()?.toLowerCase();
            const iconMap = {
                'js': 'mdi-language-javascript', 'ts': 'mdi-language-typescript',
                'json': 'mdi-code-json', 'md': 'mdi-language-markdown',
                'html': 'mdi-language-html5', 'css': 'mdi-language-css3',
                'py': 'mdi-language-python', 'pdf': 'mdi-file-pdf',
                'doc': 'mdi-file-word', 'docx': 'mdi-file-word',
                'xls': 'mdi-file-excel', 'xlsx': 'mdi-file-excel',
                'ppt': 'mdi-file-powerpoint', 'pptx': 'mdi-file-powerpoint',
            };
            return iconMap[e] || 'mdi-file';
        }

        function isOverflowDirty(path) {
            const t = editorTabStore.tabs.find(t => t.path === path);
            return t ? t.dirty : false;
        }

        onMounted(() => {
            if (scrollContainer.value && typeof ResizeObserver !== 'undefined') {
                resizeObserver = new ResizeObserver((entries) => {
                    for (const entry of entries) {
                        editorTabStore.setViewportWidth(entry.contentRect.width);
                    }
                });
                resizeObserver.observe(scrollContainer.value);
                editorTabStore.setViewportWidth(scrollContainer.value.clientWidth);
            }
        });

        onUnmounted(() => {
            if (resizeObserver) {
                resizeObserver.disconnect();
                resizeObserver = null;
            }
        });

        return {
            editorTabStore, tabs, barContainer, scrollContainer, trackStyle,
            onWheel, onDragStart, onDragMove, onDragEnd, onItemContextMenu,
            getOverflowName, getOverflowIcon, isOverflowDirty,
        };
    },
});

// ==========================================================================
// EditorConfirmDialog - 统一确认对话框
// ==========================================================================
const EditorConfirmDialog = defineComponent({
    name: 'EditorConfirmDialog',
    template: `
    <v-dialog :model-value="!!editorTabStore.pendingConfirm" max-width="420" no-click-animation>
        <v-card v-if="editorTabStore.pendingConfirm">
            <v-card-title class="text-subtitle-1 d-flex align-center">
                <v-icon class="mr-2" size="small">mdi-help-circle-outline</v-icon>
                {{ $t(editorTabStore.pendingConfirm.titleKey) }}
            </v-card-title>
            <v-card-text class="text-body-2">{{ $t(editorTabStore.pendingConfirm.messageKey, { name: editorTabStore.pendingConfirm.name || '' }) }}</v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="onCancel">{{ $t('workspace.editor.cancel') }}</v-btn>
                <template v-if="editorTabStore.pendingConfirm.type === 'saveDiscardCancel'">
                    <v-btn variant="text" color="warning" @click="onDiscard">{{ $t('workspace.editor.discard') }}</v-btn>
                    <v-btn color="primary" variant="flat" @click="onSave">{{ $t('workspace.editor.save') }}</v-btn>
                </template>
                <template v-else>
                    <v-btn color="primary" variant="flat" @click="onConfirm">{{ $t('workspace.editor.confirm') }}</v-btn>
                </template>
            </v-card-actions>
        </v-card>
    </v-dialog>
    `,
    setup() {
        const editorTabStore = useEditorTabStore();

        function onCancel() { editorTabStore.resolveConfirm('cancel'); }
        function onDiscard() { editorTabStore.resolveConfirm('discard'); }
        function onSave() { editorTabStore.resolveConfirm('save'); }
        function onConfirm() { editorTabStore.resolveConfirm(true); }

        return { editorTabStore, onCancel, onDiscard, onSave, onConfirm };
    },
});