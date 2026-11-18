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
// WorkspaceSidebar - 导航侧边栏（功能面板 / 工作区 / Git 三按钮切换）
// ==========================================================================
const WorkspaceSidebar = defineComponent({
    name: 'WorkspaceSidebar',
    template: `
    <div class="workspace-sidebar" :class="sidebarClass" data-component-id="chat-mcp.edge-toolbar">
        <v-btn
            :icon="true"
            :variant="settingStore.functionTab === 'function' ? 'flat' : 'text'"
            :color="settingStore.functionTab === 'function' ? 'primary' : 'default'"
            size="small"
            @click="settingStore.setFunctionTab('function')"
            :title="$t('workspace.sidebar.functionTab')"
            data-component-id="chat-mcp.edge-toolbar.function">
            <v-icon>mdi-view-dashboard</v-icon>
        </v-btn>
        <v-btn
            :icon="true"
            :variant="settingStore.functionTab === 'workspace' ? 'flat' : 'text'"
            :color="settingStore.functionTab === 'workspace' ? 'primary' : 'default'"
            size="small"
            @click="settingStore.setFunctionTab('workspace')"
            :title="$t('workspace.sidebar.workspaceTab')"
            data-component-id="chat-mcp.edge-toolbar.file-manager">
            <v-icon>mdi-folder</v-icon>
        </v-btn>
        <v-btn
            :icon="true"
            :variant="settingStore.functionTab === 'git' ? 'flat' : 'text'"
            :color="settingStore.functionTab === 'git' ? 'primary' : 'default'"
            size="small"
            @click="settingStore.setFunctionTab('git')"
            :title="$t('workspace.sidebar.gitTab')"
            data-component-id="chat-mcp.edge-toolbar.git">
            <v-icon>mdi-git</v-icon>
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
// TreeContextMenu - 目录树右键上下文菜单
// ==========================================================================
const TreeContextMenu = defineComponent({
    name: 'TreeContextMenu',
    template: `
    <v-menu :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)"
        :target="[x, y]" location="end start" :close-on-content-click="false" transition="none">
        <v-list density="compact" min-width="180">
            <v-list-item v-for="item in visibleItems" :key="item.action"
                @click="$emit('action', item.action)"
                :disabled="item.disabled">
                <template v-slot:prepend>
                    <v-icon size="small">{{ item.icon }}</v-icon>
                </template>
                <v-list-item-title>{{ $t(item.label) }}</v-list-item-title>
            </v-list-item>
        </v-list>
    </v-menu>
    `,
    props: {
        modelValue: { type: Boolean, default: false },
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
        target: { type: Object, default: null },
        isRoot: { type: Boolean, default: false },
        isDir: { type: Boolean, default: false },
        isBlank: { type: Boolean, default: false },
        clipboardEmpty: { type: Boolean, default: true },
    },
    emits: ['update:modelValue', 'action'],
    setup(props) {
        const ALL_ITEMS = [
            { action: 'newFile', icon: 'mdi-file-plus', label: 'workspace.explorer.contextMenu.newFile' },
            { action: 'newDir', icon: 'mdi-folder-plus', label: 'workspace.explorer.contextMenu.newDir' },
            { action: 'rename', icon: 'mdi-pencil', label: 'workspace.explorer.contextMenu.rename' },
            { action: 'delete', icon: 'mdi-delete', label: 'workspace.explorer.contextMenu.delete' },
            { action: 'copy', icon: 'mdi-content-copy', label: 'workspace.explorer.contextMenu.copy' },
            { action: 'cut', icon: 'mdi-content-cut', label: 'workspace.explorer.contextMenu.cut' },
            { action: 'paste', icon: 'mdi-content-paste', label: 'workspace.explorer.contextMenu.paste' },
            { action: 'copyPath', icon: 'mdi-link-variant', label: 'workspace.explorer.contextMenu.copyPath' },
            { action: 'copyAbsolutePath', icon: 'mdi-link', label: 'workspace.explorer.contextMenu.copyAbsolutePath' },
            { action: 'reveal', icon: 'mdi-folder-open', label: 'workspace.explorer.contextMenu.reveal' },
            { action: 'refresh', icon: 'mdi-refresh', label: 'workspace.explorer.contextMenu.refresh' },
            { action: 'collapseAll', icon: 'mdi-unfold-less-vertical', label: 'workspace.explorer.contextMenu.collapseAll' },
        ];

        const visibleItems = computed(() => {
            if (props.isBlank) {
                return [
                    { ...ALL_ITEMS[0] },
                    { ...ALL_ITEMS[1] },
                    { ...ALL_ITEMS[6], disabled: props.clipboardEmpty },
                    { ...ALL_ITEMS[10] },
                    { ...ALL_ITEMS[11] },
                ];
            }
            if (props.isDir) {
                return [
                    { ...ALL_ITEMS[0] },
                    { ...ALL_ITEMS[1] },
                    { ...ALL_ITEMS[2], disabled: props.isRoot },
                    { ...ALL_ITEMS[3], disabled: props.isRoot },
                    { ...ALL_ITEMS[4], disabled: props.isRoot },
                    { ...ALL_ITEMS[5], disabled: props.isRoot },
                    { ...ALL_ITEMS[6], disabled: props.clipboardEmpty },
                    { ...ALL_ITEMS[7] },
                    { ...ALL_ITEMS[8] },
                    { ...ALL_ITEMS[9] },
                    { ...ALL_ITEMS[10] },
                    { ...ALL_ITEMS[11] },
                ];
            }
            return [
                { ...ALL_ITEMS[0] },
                { ...ALL_ITEMS[1] },
                { ...ALL_ITEMS[2], disabled: props.isRoot },
                { ...ALL_ITEMS[3], disabled: props.isRoot },
                { ...ALL_ITEMS[4], disabled: props.isRoot },
                { ...ALL_ITEMS[5], disabled: props.isRoot },
                { ...ALL_ITEMS[7] },
                { ...ALL_ITEMS[8] },
                { ...ALL_ITEMS[9] },
            ];
        });

        return { visibleItems };
    },
});


// ==========================================================================
// InlineNameInput - 内联命名输入组件
// ==========================================================================
const InlineNameInput = defineComponent({
    name: 'InlineNameInput',
    template: `
    <div class="inline-name-input d-flex align-center" @click.stop>
        <v-icon size="small" class="mr-1">{{ icon }}</v-icon>
        <v-text-field
            ref="inputRef"
            v-model="currentText"
            density="compact"
            variant="plain"
            hide-details
            autofocus
            class="inline-name-field"
            :error="errorStatus"
            @keydown.enter.prevent="submit"
            @keydown.escape.prevent.stop="$emit('cancel')"
            @blur="onBlur">
        </v-text-field>
        <div v-if="errorStatus" class="text-error text-caption mt-1">{{ errorText }}</div>
    </div>
    `,
    props: {
        initialValue: { type: String, default: '' },
        selectStrategy: { type: String, default: 'all' },
        validate: { type: Function, default: null },
        isDir: { type: Boolean, default: false },
    },
    emits: ['submit', 'cancel'],
    setup(props, { emit }) {
        const currentText = ref(props.initialValue);
        const inputRef = ref(null);
        const validateStatus = ref('unchecked');

        const icon = computed(() => props.isDir ? 'mdi-folder' : 'mdi-file');

        const errorStatus = computed(() => {
            return validateStatus.value === 'nameConflict'
                || validateStatus.value === 'illegalChar'
                || validateStatus.value === 'empty'
                || validateStatus.value === 'reserved';
        });

        const errorText = computed(() => {
            const map = {
                nameConflict: 'workspace.explorer.inlineInput.nameConflict',
                illegalChar: 'workspace.explorer.inlineInput.illegalChar',
                empty: 'workspace.explorer.inlineInput.nameEmpty',
                reserved: 'workspace.explorer.inlineInput.reservedName',
            };
            return map[validateStatus.value] || '';
        });

        function applySelection() {
            nextTick(() => {
                const el = inputRef.value?.$el?.querySelector('input');
                if (!el) return;
                if (props.selectStrategy === 'nameBody') {
                    const dotIdx = props.initialValue.lastIndexOf('.');
                    if (dotIdx > 0) {
                        el.setSelectionRange(0, dotIdx);
                    } else {
                        el.select();
                    }
                } else {
                    el.select();
                }
                el.focus();
            });
        }

        onMounted(() => {
            applySelection();
        });

        function submit() {
            const name = currentText.value.trim();
            if (props.validate) {
                const status = props.validate(name);
                validateStatus.value = status;
                if (status !== 'valid') return;
            }
            emit('submit', name);
        }

        function onBlur() {
            submit();
        }

        return { currentText, inputRef, icon, errorStatus, errorText, submit, onBlur };
    },
});


// ==========================================================================
// ConflictDialog - 同名冲突解决对话框
// ==========================================================================
const ConflictDialog = defineComponent({
    name: 'ConflictDialog',
    template: `
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)"
        max-width="420" persistent>
        <v-card>
            <v-card-title class="text-h6">
                <v-icon class="mr-2">mdi-alert</v-icon>
                {{ $t('workspace.explorer.conflict.title') }}
            </v-card-title>
            <v-card-text>
                <p class="text-body-2 mb-3">{{ itemName }}</p>
                <v-radio-group v-model="choice">
                    <v-radio value="overwrite" :label="$t('workspace.explorer.conflict.overwrite')"></v-radio>
                    <v-radio value="skip" :label="$t('workspace.explorer.conflict.skip')"></v-radio>
                    <v-radio value="rename" :label="$t('workspace.explorer.conflict.rename')"></v-radio>
                </v-radio-group>
                <v-checkbox v-if="multiple" v-model="applyToAll"
                    :label="$t('workspace.explorer.conflict.applyToAll')" density="compact"></v-checkbox>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="$emit('resolve', choice, applyToAll)">
                    {{ $t('workspace.editor.confirm') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
    `,
    props: {
        modelValue: { type: Boolean, default: false },
        itemName: { type: String, default: '' },
        multiple: { type: Boolean, default: false },
    },
    emits: ['update:modelValue', 'resolve'],
    setup() {
        const choice = ref('rename');
        const applyToAll = ref(false);
        return { choice, applyToAll };
    },
});


// ==========================================================================
// DeleteConfirmDialog - 删除确认对话框
// ==========================================================================
const DeleteConfirmDialog = defineComponent({
    name: 'DeleteConfirmDialog',
    template: `
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)"
        max-width="420" persistent>
        <v-card>
            <v-card-title class="text-h6">
                <v-icon class="mr-2" color="error">mdi-delete-alert</v-icon>
                {{ $t('workspace.explorer.ops.deleteConfirmTitle') }}
            </v-card-title>
            <v-card-text>
                <p class="text-body-2">{{ message }}</p>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="$emit('update:modelValue', false); $emit('cancel')">
                    {{ $t('workspace.editor.cancel') }}
                </v-btn>
                <v-btn color="error" variant="flat" @click="$emit('update:modelValue', false); $emit('confirm')">
                    {{ $t('workspace.explorer.contextMenu.delete') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
    `,
    props: {
        modelValue: { type: Boolean, default: false },
        targetName: { type: String, default: '' },
    },
    emits: ['update:modelValue', 'confirm', 'cancel'],
    setup(props) {
        const message = computed(() => {
            return props.targetName;
        });
        return { message };
    },
});


// ==========================================================================
// WorkspaceExplorer - 工作目录文件树浏览器
// ==========================================================================
const WorkspaceExplorer = defineComponent({
    name: 'WorkspaceExplorer',
    components: {
        'tree-context-menu': TreeContextMenu,
        'inline-name-input': InlineNameInput,
        'conflict-dialog': ConflictDialog,
        'delete-confirm-dialog': DeleteConfirmDialog,
    },
    template: `
    <div class="workspace-explorer d-flex flex-column" style="height:100%;"
        @contextmenu.prevent="onBlankContextMenu">
        <div class="workspace-explorer-header d-flex align-center px-3 py-2">
            <v-icon size="small" class="mr-2">mdi-folder</v-icon>
            <span class="text-body-2 text-truncate" style="min-width:0;">
                {{ activeWorkspace ? activeWorkspace.name : $t('workspace.explorer.noWorkspace') }}
            </span>
            <v-spacer></v-spacer>
            <v-btn icon size="x-small" variant="text" @click="refreshTree"
                :title="$t('workspace.explorer.contextMenu.refresh')">
                <v-icon>mdi-refresh</v-icon>
            </v-btn>
            <v-btn icon size="x-small" variant="text" @click="collapseAll"
                :title="$t('workspace.explorer.contextMenu.collapseAll')">
                <v-icon>mdi-unfold-less-vertical</v-icon>
            </v-btn>
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
        <div class="workspace-explorer-tree flex-grow-1 overflow-y-auto" v-if="activeWorkspace"
            ref="treeContainerRef"
            tabindex="0"
            @keydown="onTreeKeydown"
            @focus="treeFocused = true"
            @blur="treeFocused = false">
            <v-treeview
                :items="treeItems"
                :load-children="loadChildren"
                item-title="name"
                item-value="path"
                item-children="children"
                density="compact"
                activatable
                :opened="openedPaths"
                @update:opened="openedPaths = $event"
                @update:active="onActiveChange">
                <template v-slot:prepend="{ item, isOpen }">
                    <v-icon size="small"
                        @click.stop="onItemClick(item)"
                        @contextmenu.prevent.stop="onNodeContextMenu($event, item)"
                        @dragstart="onDragStart($event, item)"
                        @dragover.prevent="onDragOver($event, item)"
                        @drop.prevent="onDrop($event, item)"
                        @dragend="onDragEnd"
                        :draggable="!isRootNode(item)"
                        :style="getNodeStyle(item)"
                        style="cursor:pointer;">
                        {{ item.isDir ? (isOpen ? 'mdi-folder-open' : 'mdi-folder') : getFileIcon(item.name) }}
                    </v-icon>
                </template>
                <template v-slot:title="{ item }">
                    <inline-name-input
                        v-if="editingNode && editingNode.path === item.path"
                        :initial-value="editingNode.initialValue"
                        :select-strategy="editingNode.selectStrategy"
                        :is-dir="item.isDir"
                        :validate="editingNode.validate"
                        @submit="onInlineSubmit"
                        @cancel="onInlineCancel">
                    </inline-name-input>
                    <span v-else
                        @click.stop="onItemClick(item)"
                        @dblclick.stop="onItemDblClick(item)"
                        @contextmenu.prevent.stop="onNodeContextMenu($event, item)"
                        :style="getNodeStyle(item)"
                        style="cursor:pointer;">{{ item.name }}</span>
                </template>
            </v-treeview>
        </div>
        <div class="d-flex align-center justify-center flex-grow-1 text-grey" v-else>
            <span class="text-body-2">{{ $t('workspace.explorer.noWorkspace') }}</span>
        </div>
        <v-overlay :model-value="workspaceStore.switching" contained class="align-center justify-center">
            <v-progress-circular indeterminate size="32"></v-progress-circular>
        </v-overlay>
        <tree-context-menu
            v-model="contextMenu.show"
            :x="contextMenu.x"
            :y="contextMenu.y"
            :target="contextMenu.target"
            :is-root="contextMenu.isRoot"
            :is-dir="contextMenu.isDir"
            :is-blank="contextMenu.isBlank"
            :clipboard-empty="clipboardStore.isEmpty"
            @action="onMenuAction">
        </tree-context-menu>
        <delete-confirm-dialog
            v-model="deleteDialog.show"
            :target-name="deleteDialog.targetName"
            @confirm="onDeleteConfirm"
            @cancel="onDeleteCancel">
        </delete-confirm-dialog>
        <conflict-dialog
            v-model="conflictDialog.show"
            :item-name="conflictDialog.itemName"
            :multiple="conflictDialog.multiple"
            @resolve="onConflictResolve">
        </conflict-dialog>
    </div>
    `,
    emits: ['file-select'],
    setup(props, { emit }) {
        const workspaceStore = useWorkspaceStore();
        const editorTabStore = useEditorTabStore();
        const clipboardStore = useClipboardStore();
        const snackbarStore = useSnackbarStore();
        const { t: i18nT } = useI18n({ useScope: 'global' });
        const treeItems = ref([]);
        const openedPaths = ref([]);
        const activePath = ref(null);
        const treeFocused = ref(false);
        const treeContainerRef = ref(null);

        const activeWorkspace = computed(() => workspaceStore.activeWorkspace);

        const pathDisplay = computed(() => {
            if (!activeWorkspace.value) return '';
            const p = activeWorkspace.value.path;
            return p.length > 40 ? p.substring(0, 15) + '...' + p.substring(p.length - 20) : p;
        });

        const contextMenu = reactive({
            show: false,
            x: 0,
            y: 0,
            target: null,
            isRoot: false,
            isDir: false,
            isBlank: false,
        });

        const editingNode = ref(null);

        const deleteDialog = reactive({
            show: false,
            targetName: '',
            targetPath: '',
        });

        const conflictDialog = reactive({
            show: false,
            itemName: '',
            multiple: false,
            resolve: null,
        });

        const dragState = reactive({
            source: null,
        });

        const ILLEGAL_CHARS = new Set(['/', '\\', ':', '*', '?', '"', '<', '>', '|']);
        const RESERVED_NAMES = new Set(['node_modules', '.git']);

        function isRootNode(item) {
            if (!activeWorkspace.value || !item) return false;
            return item.path === activeWorkspace.value.path;
        }

        function getNodeStyle(item) {
            if (item && item.path && clipboardStore.hasCut && clipboardStore.cutIndicators.includes(item.path)) {
                return { opacity: '0.5' };
            }
            return {};
        }

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

        function findParent(items, path, parent) {
            for (const item of items) {
                if (item.path === path) return parent;
                if (item.children) {
                    const found = findParent(item.children, path, item);
                    if (found !== null) return found;
                }
            }
            return null;
        }

        async function refreshNode(nodePath) {
            if (!nodePath) return;
            const node = findInTree(treeItems.value, nodePath);
            if (node && node.isDir) {
                await loadChildren(node);
            } else {
                const parent = findParent(treeItems.value, nodePath, null);
                if (parent) {
                    await loadChildren(parent);
                } else {
                    await loadRoot();
                }
            }
        }

        function onItemClick(item) {
            if (item && !item.isDir) {
                emit('file-select', item.path);
            }
        }

        function onItemDblClick(item) {
            if (item && !isRootNode(item)) {
                startRename(item);
            }
        }

        function onActiveChange(active) {
            if (!active || active.length === 0) {
                activePath.value = null;
                return;
            }
            const val = active[0];
            if (typeof val === 'string') {
                activePath.value = val;
                const item = findInTree(treeItems.value, val);
                if (item && !item.isDir) {
                    emit('file-select', val);
                }
            } else if (val && val.path && !val.isDir) {
                activePath.value = val.path;
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

        function validateName(name, isDir, originalName) {
            if (!name || name.trim().length === 0) return 'empty';
            for (const ch of name) {
                if (ILLEGAL_CHARS.has(ch)) return 'illegalChar';
            }
            if (originalName && name === originalName) return 'valid';
            if (isDir && RESERVED_NAMES.has(name)) return 'reserved';
            return 'valid';
        }

        function checkNameConflict(parentDir, name, excludePath) {
            const parent = findInTree(treeItems.value, parentDir)
                || findParent(treeItems.value, parentDir, null);
            const siblings = parent ? parent.children : treeItems.value;
            if (!siblings) return false;
            for (const s of siblings) {
                if (s.path === excludePath) continue;
                if (s.name === name) return true;
            }
            return false;
        }

        function onNodeContextMenu(e, item) {
            contextMenu.x = e.clientX;
            contextMenu.y = e.clientY;
            contextMenu.target = item;
            contextMenu.isRoot = isRootNode(item);
            contextMenu.isDir = item.isDir;
            contextMenu.isBlank = false;
            contextMenu.show = true;
        }

        function onBlankContextMenu(e) {
            contextMenu.x = e.clientX;
            contextMenu.y = e.clientY;
            contextMenu.target = null;
            contextMenu.isRoot = true;
            contextMenu.isDir = true;
            contextMenu.isBlank = true;
            contextMenu.show = true;
        }

        async function onMenuAction(action) {
            contextMenu.show = false;
            const target = contextMenu.target;
            const isBlank = contextMenu.isBlank;

            switch (action) {
                case 'newFile':
                    startCreate(target, isBlank, false);
                    break;
                case 'newDir':
                    startCreate(target, isBlank, true);
                    break;
                case 'rename':
                    if (target && !isRootNode(target)) startRename(target);
                    break;
                case 'delete':
                    if (target && !isRootNode(target)) startDelete(target);
                    break;
                case 'copy':
                    if (target && !isRootNode(target)) clipboardStore.setCopy([target.path]);
                    break;
                case 'cut':
                    if (target && !isRootNode(target)) clipboardStore.setCut([target.path]);
                    break;
                case 'paste':
                    await doPaste(target, isBlank);
                    break;
                case 'copyPath':
                    if (target) await doCopyPath(target, false);
                    break;
                case 'copyAbsolutePath':
                    if (target) await doCopyPath(target, true);
                    break;
                case 'reveal':
                    if (target) await doReveal(target);
                    break;
                case 'refresh':
                    await refreshTree();
                    break;
                case 'collapseAll':
                    collapseAll();
                    break;
            }
        }

        function getCreateTargetDir(target, isBlank) {
            if (isBlank || !target) return activeWorkspace.value.path;
            if (target.isDir) return target.path;
            const parent = findParent(treeItems.value, target.path, null);
            return parent ? parent.path : activeWorkspace.value.path;
        }

        function startCreate(target, isBlank, isDir) {
            const parentDir = getCreateTargetDir(target, isBlank);
            const parent = findInTree(treeItems.value, parentDir);
            const placeholder = isDir
                ? i18nT('workspace.explorer.inlineInput.placeholderDir')
                : i18nT('workspace.explorer.inlineInput.placeholderFile');

            editingNode.value = {
                path: '__new__' + Date.now(),
                initialValue: placeholder,
                selectStrategy: 'all',
                isDir: isDir,
                parentDir: parentDir,
                isNew: true,
                validate: (name) => {
                    const base = validateName(name, isDir, null);
                    if (base !== 'valid') return base;
                    if (checkNameConflict(parentDir, name, null)) return 'nameConflict';
                    return 'valid';
                },
            };

            if (parent && parent.isDir) {
                if (!parent.children) parent.children = [];
                parent.children.unshift({
                    name: placeholder,
                    path: editingNode.value.path,
                    isDir: isDir,
                    children: isDir ? [] : undefined,
                    _isNew: true,
                });
                if (!openedPaths.value.includes(parent.path)) {
                    openedPaths.value = [...openedPaths.value, parent.path];
                }
            } else if (!target || isBlank) {
                treeItems.value.unshift({
                    name: placeholder,
                    path: editingNode.value.path,
                    isDir: isDir,
                    children: isDir ? [] : undefined,
                    _isNew: true,
                });
            }
        }

        function startRename(item) {
            editingNode.value = {
                path: item.path,
                initialValue: item.name,
                selectStrategy: 'nameBody',
                isDir: item.isDir,
                isNew: false,
                originalName: item.name,
                validate: (name) => {
                    const base = validateName(name, item.isDir, item.name);
                    if (base !== 'valid') return base;
                    const parent = findParent(treeItems.value, item.path, null);
                    const parentDir = parent ? parent.path : activeWorkspace.value.path;
                    if (checkNameConflict(parentDir, name, item.path)) return 'nameConflict';
                    return 'valid';
                },
            };
        }

        async function onInlineSubmit(name) {
            const ed = editingNode.value;
            if (!ed) return;
            editingNode.value = null;

            if (ed.isNew) {
                const parent = findInTree(treeItems.value, ed.parentDir);
                const siblings = parent ? parent.children : treeItems.value;
                if (siblings) {
                    const idx = siblings.findIndex(s => s.path === ed.path || s._isNew);
                    if (idx >= 0) siblings.splice(idx, 1);
                }
                try {
                    const result = ed.isDir
                        ? await window.workspaceAPI.createDir(ed.parentDir, name)
                        : await window.workspaceAPI.createFile(ed.parentDir, name);
                    if (result.success) {
                        snackbarStore.showSuccessMessage(i18nT('workspace.explorer.ops.createSuccess'));
                        await refreshNode(ed.parentDir);
                    } else {
                        snackbarStore.showErrorMessage(result.error || 'Create failed');
                    }
                } catch (err) {
                    snackbarStore.showErrorMessage(String(err));
                }
            } else {
                if (name === ed.originalName) return;
                try {
                    const result = await window.workspaceAPI.renamePath(ed.path, name);
                    if (result.success) {
                        editorTabStore.onFileRenamed(ed.path, result.affectedPaths[1]);
                        snackbarStore.showSuccessMessage(i18nT('workspace.explorer.ops.renameSuccess'));
                        const parent = findParent(treeItems.value, ed.path, null);
                        const parentDir = parent ? parent.path : activeWorkspace.value.path;
                        await refreshNode(parentDir);
                    } else {
                        snackbarStore.showErrorMessage(result.error || 'Rename failed');
                    }
                } catch (err) {
                    snackbarStore.showErrorMessage(String(err));
                }
            }
        }

        function onInlineCancel() {
            const ed = editingNode.value;
            if (ed && ed.isNew) {
                const parent = findInTree(treeItems.value, ed.parentDir);
                const siblings = parent ? parent.children : treeItems.value;
                if (siblings) {
                    const idx = siblings.findIndex(s => s.path === ed.path || s._isNew);
                    if (idx >= 0) siblings.splice(idx, 1);
                }
            }
            editingNode.value = null;
        }

        async function startDelete(item) {
            const canDelete = await editorTabStore.onFileDeleted(item.path);
            if (!canDelete) return;
            deleteDialog.targetName = i18nT('workspace.explorer.ops.deleteConfirmMessage', { name: item.name });
            deleteDialog.targetPath = item.path;
            deleteDialog.show = true;
        }

        async function onDeleteConfirm() {
            const targetPath = deleteDialog.targetPath;
            deleteDialog.show = false;
            try {
                const result = await window.workspaceAPI.removePath(targetPath);
                if (result.success) {
                    snackbarStore.showSuccessMessage(i18nT('workspace.explorer.ops.deleteSuccess'));
                    const parent = findParent(treeItems.value, targetPath, null);
                    const parentDir = parent ? parent.path : activeWorkspace.value.path;
                    await refreshNode(parentDir);
                } else if (result.failedPaths && result.failedPaths.length > 0) {
                    snackbarStore.showWarningMessage(i18nT('workspace.explorer.ops.partialFailure'));
                    await refreshNode(targetPath);
                } else {
                    snackbarStore.showErrorMessage(result.error || 'Delete failed');
                }
            } catch (err) {
                snackbarStore.showErrorMessage(String(err));
            }
        }

        function onDeleteCancel() {
            deleteDialog.show = false;
        }

        async function doPaste(target, isBlank) {
            const clip = clipboardStore.consume();
            if (!clip || clip.items.length === 0) return;
            const destDir = isBlank || !target
                ? activeWorkspace.value.path
                : (target.isDir ? target.path : (findParent(treeItems.value, target.path, null)?.path || activeWorkspace.value.path));

            for (const srcPath of clip.items) {
                const name = srcPath.split(/[\\/]/).pop();
                const destPath = destDir + '/' + name;
                if (await checkPathExists(destPath)) {
                    conflictDialog.itemName = name;
                    conflictDialog.multiple = clip.items.length > 1;
                    conflictDialog.show = true;
                    const choice = await new Promise(resolve => {
                        conflictDialog.resolve = resolve;
                    });
                    if (choice === 'skip') continue;
                    try {
                        if (clip.opType === 'cut') {
                            const result = await window.workspaceAPI.movePath(srcPath, destDir, choice);
                            if (result.success) {
                                editorTabStore.onFileMoved(srcPath, result.affectedPaths[1]);
                            } else {
                                snackbarStore.showErrorMessage(result.error);
                                continue;
                            }
                        } else {
                            const result = await window.workspaceAPI.copyPath(srcPath, destDir, choice);
                            if (!result.success) {
                                snackbarStore.showErrorMessage(result.error);
                                continue;
                            }
                        }
                    } catch (err) {
                        snackbarStore.showErrorMessage(String(err));
                        continue;
                    }
                } else {
                    try {
                        if (clip.opType === 'cut') {
                            const result = await window.workspaceAPI.movePath(srcPath, destDir, 'rename');
                            if (result.success) {
                                editorTabStore.onFileMoved(srcPath, result.affectedPaths[1]);
                            } else {
                                snackbarStore.showErrorMessage(result.error);
                                continue;
                            }
                        } else {
                            const result = await window.workspaceAPI.copyPath(srcPath, destDir, 'rename');
                            if (!result.success) {
                                snackbarStore.showErrorMessage(result.error);
                                continue;
                            }
                        }
                    } catch (err) {
                        snackbarStore.showErrorMessage(String(err));
                        continue;
                    }
                }
            }

            if (clip.opType === 'cut') {
                clipboardStore.clear();
            }
            snackbarStore.showSuccessMessage(i18nT('workspace.explorer.ops.pasteSuccess'));
            await refreshNode(destDir);
        }

        function onConflictResolve(choice, applyToAll) {
            conflictDialog.show = false;
            if (conflictDialog.resolve) {
                conflictDialog.resolve(choice);
                conflictDialog.resolve = null;
            }
        }

        async function checkPathExists(p) {
            try {
                const parent = findInTree(treeItems.value, p.split(/[\\/]/).slice(0, -1).join('/'));
                const name = p.split(/[\\/]/).pop();
                const siblings = parent ? parent.children : treeItems.value;
                return siblings ? siblings.some(s => s.name === name) : false;
            } catch {
                return false;
            }
        }

        async function doCopyPath(item, absolute) {
            try {
                const result = await window.workspaceAPI.copyPathText(item.path, absolute);
                if (result.success) {
                    snackbarStore.showInfoMessage(i18nT('workspace.explorer.ops.pathCopied'));
                } else {
                    snackbarStore.showErrorMessage(result.error || i18nT('workspace.explorer.ops.copyPathFailed'));
                }
            } catch (err) {
                snackbarStore.showErrorMessage(i18nT('workspace.explorer.ops.copyPathFailed'));
            }
        }

        async function doReveal(item) {
            try {
                if (item.isDir) {
                    await window.workspaceAPI.copyPathText(item.path, true);
                }
            } catch (err) {
                console.error('Reveal failed:', err);
            }
        }

        async function refreshTree() {
            const expanded = [...openedPaths.value];
            await loadRoot();
            for (const p of expanded) {
                const node = findInTree(treeItems.value, p);
                if (node && node.isDir) {
                    await loadChildren(node);
                }
            }
            openedPaths.value = expanded.filter(p => findInTree(treeItems.value, p));
        }

        function collapseAll() {
            openedPaths.value = [];
        }

        function onDragStart(e, item) {
            if (isRootNode(item)) {
                e.preventDefault();
                return;
            }
            dragState.source = item;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.path);
        }

        function onDragOver(e, item) {
            if (!dragState.source) return;
            if (!item || !item.isDir) {
                e.dataTransfer.dropEffect = 'none';
                return;
            }
            if (isPathUnderClient(dragState.source.path, item.path)) {
                e.dataTransfer.dropEffect = 'none';
                return;
            }
            e.dataTransfer.dropEffect = 'move';
        }

        function isPathUnderClient(srcPath, destPath) {
            if (srcPath === destPath) return true;
            return destPath.startsWith(srcPath + '/') || destPath.startsWith(srcPath + '\\');
        }

        async function onDrop(e, item) {
            if (!dragState.source || !item || !item.isDir) return;
            const src = dragState.source;
            dragState.source = null;

            if (isPathUnderClient(src.path, item.path)) {
                snackbarStore.showWarningMessage(i18nT('workspace.explorer.ops.circularMove'));
                return;
            }

            try {
                const result = await window.workspaceAPI.movePath(src.path, item.path, 'rename');
                if (result.success) {
                    editorTabStore.onFileMoved(src.path, result.affectedPaths[1]);
                    snackbarStore.showSuccessMessage(i18nT('workspace.explorer.ops.moveSuccess'));
                    const srcParent = findParent(treeItems.value, src.path, null);
                    if (srcParent) await refreshNode(srcParent.path);
                    await refreshNode(item.path);
                } else {
                    snackbarStore.showErrorMessage(result.error || 'Move failed');
                }
            } catch (err) {
                snackbarStore.showErrorMessage(String(err));
            }
        }

        function onDragEnd() {
            dragState.source = null;
        }

        function onTreeKeydown(e) {
            if (!treeFocused.value) return;
            if (editingNode.value) {
                if (e.key === 'Escape') {
                    onInlineCancel();
                }
                return;
            }

            const activeItem = getActiveItem();
            if (!activeItem && e.key !== 'F5' && e.key !== 'Escape') return;

            switch (e.key) {
                case 'F2':
                    e.preventDefault();
                    if (activeItem && !isRootNode(activeItem)) startRename(activeItem);
                    break;
                case 'Delete':
                    e.preventDefault();
                    if (activeItem && !isRootNode(activeItem)) startDelete(activeItem);
                    break;
                case 'F5':
                    e.preventDefault();
                    refreshTree();
                    break;
                case 'Escape':
                    e.preventDefault();
                    clipboardStore.clear();
                    break;
                case 'c':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        if (activeItem && !isRootNode(activeItem)) clipboardStore.setCopy([activeItem.path]);
                    }
                    break;
                case 'x':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        if (activeItem && !isRootNode(activeItem)) clipboardStore.setCut([activeItem.path]);
                    }
                    break;
                case 'v':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        if (activeItem) doPaste(activeItem, false);
                    }
                    break;
                case 'C':
                    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
                        e.preventDefault();
                        if (activeItem) doCopyPath(activeItem, false);
                    }
                    break;
            }
        }

        function getActiveItem() {
            if (!activePath.value) return null;
            return findInTree(treeItems.value, activePath.value);
        }

        async function switchWorkspace() {
            const dir = await workspaceStore.chooseDirectory();
            if (!dir) return;

            clipboardStore.clear();
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
            clipboardStore.clear();
            loadRoot();
        }, { immediate: true });

        return {
            workspaceStore, activeWorkspace, pathDisplay, treeItems, openedPaths, activePath,
            treeFocused, treeContainerRef, contextMenu, editingNode, deleteDialog, conflictDialog,
            clipboardStore,
            loadChildren, onItemClick, onItemDblClick, onActiveChange, getFileIcon,
            switchWorkspace, refreshTree, collapseAll,
            onNodeContextMenu, onBlankContextMenu, onMenuAction,
            onInlineSubmit, onInlineCancel,
            onDeleteConfirm, onDeleteCancel,
            onConflictResolve,
            onDragStart, onDragOver, onDrop, onDragEnd,
            onTreeKeydown,
            isRootNode, getNodeStyle,
        };
    },
});

// ==========================================================================
// EditorStatusBar - 编辑器状态栏（语言名称 + LSP 状态 + 导航级别）
// 位于 editor-tab-bar 与 file-editor 之间
// ==========================================================================
const EditorStatusBar = defineComponent({
    name: 'EditorStatusBar',
    template: `
    <div class="editor-status-bar" v-if="visible">
        <span class="status-bar-lang">{{ languageDisplayName }}</span>
        <template v-if="lspConfigExists">
            <span class="status-bar-separator">|</span>
            <v-icon size="x-small" :color="lspStatusColor" style="cursor:pointer"
                :title="lspStatusText"
                @click="settingStore.lspConfigDialog = true">
                {{ lspStatusIcon }}
            </v-icon>
            <span style="cursor:pointer" @click="settingStore.lspConfigDialog = true">
                {{ lspStatusText }}
            </span>
        </template>
        <span class="status-bar-separator">|</span>
        <v-icon size="x-small">mdi-compass</v-icon>
        <span>{{ navigationLevelText }}</span>
    </div>
    `,
    setup() {
        const editorTabStore = useEditorTabStore();
        const settingStore = useSettingStore();

        const activePath = computed(() => editorTabStore.activePath);
        const activeTab = computed(() => editorTabStore.activeTab);
        const visible = computed(() => {
            return !!activePath.value && activeTab.value && activeTab.value.viewMode === 'edit';
        });

        const currentLanguage = computed(() => {
            try {
                if (!activePath.value) return '';
                return window.getLanguageByExtension(activePath.value);
            } catch (e) {
                return '';
            }
        });

        const languageDisplayName = computed(() => {
            const lang = currentLanguage.value;
            if (!lang) {
                try { return window.i18n?.global?.t?.('workspace.statusBar.unknown') || '未知'; }
                catch (e) { return '未知'; }
            }
            if (lang === 'plaintext') {
                try { return window.i18n?.global?.t?.('workspace.statusBar.plaintext') || '纯文本'; }
                catch (e) { return '纯文本'; }
            }
            return lang.charAt(0).toUpperCase() + lang.slice(1);
        });

        const lspConfigExists = computed(() => {
            try {
                if (!currentLanguage.value || !window.LSPConfigManager) return false;
                return !!window.LSPConfigManager.getConfig(currentLanguage.value);
            } catch (e) {
                return false;
            }
        });

        const lspStatus = ref('stopped');

        const lspStatusColor = computed(() => {
            const s = lspStatus.value;
            if (s === 'ready') return 'green';
            if (s === 'starting') return 'orange';
            if (s === 'error') return 'red';
            return 'grey';
        });

        const lspStatusIcon = computed(() => {
            const s = lspStatus.value;
            if (s === 'starting') return 'mdi-loading mdi-spin';
            if (s === 'ready') return 'mdi-check-circle';
            if (s === 'error') return 'mdi-alert-circle';
            if (s === 'unavailable') return 'mdi-close-circle-outline';
            return 'mdi-circle-outline';
        });

        const lspStatusText = computed(() => {
            const lang = currentLanguage.value;
            if (!lang) return '';
            const langName = lang.charAt(0).toUpperCase() + lang.slice(1);
            let prefix, statusText;
            try {
                prefix = window.i18n?.global?.t?.('workspace.statusBar.lspServer') || ' 语言服务器：';
            } catch (e) {
                prefix = ' 语言服务器：';
            }
            try {
                statusText = window.i18n?.global?.t?.('workspace.statusBar.lsp_' + lspStatus.value) || lspStatus.value;
            } catch (e) {
                statusText = lspStatus.value;
            }
            return langName + prefix + statusText;
        });

        const navLevel = ref('highlight');

        const navigationLevelText = computed(() => {
            let prefix, levelText;
            try {
                prefix = window.i18n?.global?.t?.('workspace.statusBar.navigation') || '导航：';
            } catch (e) {
                prefix = '导航：';
            }
            try {
                levelText = window.i18n?.global?.t?.('workspace.statusBar.nav_' + navLevel.value) || navLevel.value;
            } catch (e) {
                levelText = navLevel.value;
            }
            return prefix + levelText;
        });

        let unlistenFn = null;

        function updateLspStatus(lang) {
            try {
                if (window.LSPServerStatusManager) {
                    lspStatus.value = window.LSPServerStatusManager.getStatus(lang);
                } else {
                    lspStatus.value = 'stopped';
                }
            } catch (e) {
                lspStatus.value = 'stopped';
            }
        }

        function updateNavLevel(lang) {
            try {
                if (window.NavigationLevelResolver) {
                    navLevel.value = window.NavigationLevelResolver.resolveEffective(lang);
                } else if (window.getNavigationLevel) {
                    navLevel.value = window.getNavigationLevel(lang);
                } else {
                    navLevel.value = 'unknown';
                }
            } catch (e) {
                navLevel.value = 'unknown';
            }
        }

        function registerStatusCallback(lang) {
            try {
                if (unlistenFn) {
                    unlistenFn();
                    unlistenFn = null;
                }
                if (window.LSPServerStatusManager && lang) {
                    unlistenFn = window.LSPServerStatusManager.onStatusChanged(lang, (newStatus) => {
                        lspStatus.value = newStatus;
                        updateNavLevel(lang);
                    });
                }
            } catch (e) {}
        }

        watch(currentLanguage, (newLang) => {
            updateLspStatus(newLang);
            updateNavLevel(newLang);
            registerStatusCallback(newLang);
        });

        onMounted(() => {
            updateLspStatus(currentLanguage.value);
            updateNavLevel(currentLanguage.value);
            registerStatusCallback(currentLanguage.value);
        });

        onUnmounted(() => {
            if (unlistenFn) {
                unlistenFn();
                unlistenFn = null;
            }
        });

        return {
            visible, languageDisplayName, lspConfigExists,
            lspStatusColor, lspStatusIcon, lspStatusText,
            navigationLevelText, settingStore,
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
        <div class="d-flex flex-grow-1" v-else-if="viewMode === 'edit'" style="overflow:hidden;">
            <div class="file-editor-body flex-grow-1" ref="editorContainer"></div>
        </div>
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
        <div class="d-flex flex-grow-1" v-else-if="viewMode === 'markdown'" style="overflow:hidden;">
            <div class="markdown-editor-source flex-grow-1" style="overflow:hidden;">
                <div class="markdown-editor-toolbar d-flex align-center px-2 py-1">
                    <v-btn size="small" variant="text" @click="mdViewMode = 'split'"
                        :color="mdViewMode === 'split' ? 'primary' : ''">
                        <v-icon size="small" class="mr-1">mdi-view-split-vertical</v-icon>
                        Split
                    </v-btn>
                    <v-btn size="small" variant="text" @click="mdViewMode = 'edit'"
                        :color="mdViewMode === 'edit' ? 'primary' : ''">
                        <v-icon size="small" class="mr-1">mdi-pencil</v-icon>
                        Edit
                    </v-btn>
                    <v-btn size="small" variant="text" @click="mdViewMode = 'preview'"
                        :color="mdViewMode === 'preview' ? 'primary' : ''">
                        <v-icon size="small" class="mr-1">mdi-eye</v-icon>
                        Preview
                    </v-btn>
                </div>
                <div class="d-flex flex-grow-1" style="overflow:hidden;">
                    <textarea v-if="mdViewMode !== 'preview'"
                        class="markdown-editor-textarea flex-grow-1"
                        v-model="mdContent"
                        @input="onMdInput"
                        spellcheck="false"></textarea>
                    <div v-if="mdViewMode !== 'edit'"
                        class="markdown-editor-preview flex-grow-1 overflow-y-auto pa-3"
                        v-html="mdRenderedHtml"></div>
                </div>
            </div>
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
        const workspaceStore = useWorkspaceStore();
        const settingStore = useSettingStore();
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
        const mdViewMode = ref('split');
        const mdContent = ref('');
        const mdRenderedHtml = ref('');
        let mdRenderTimer = null;
        let mdLargeFile = false;
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
            return window.getLanguageByExtension(filePath);
        }


        async function renderMarkdownPreview() {
            if (mdLargeFile) {
                mdRenderedHtml.value = '<div class="text-caption text-grey pa-2">文件过大，实时预览已暂停</div>';
                return;
            }
            try {
                const workspacePath = workspaceStore?.activeWorkspace?.path || '';
                const html = await window.MarkdownRenderPipeline.render(mdContent.value, { workspacePath });
                mdRenderedHtml.value = html;
            } catch (e) {
                mdRenderedHtml.value = '<div class="text-caption text-error pa-2">Render error: ' + e.message + '</div>';
            }
        }

        function onMdInput() {
            if (mdRenderTimer) clearTimeout(mdRenderTimer);
            mdRenderTimer = setTimeout(() => renderMarkdownPreview(), 200);
            if (currentLoadedPath) {
                editorTabStore.setDirty(currentLoadedPath, true);
                editorTabStore.registerContentProvider(currentLoadedPath, () => mdContent.value);
            }
        }

        function cleanupEditor() {
            if (editor && window.LSPDocumentSyncManager) {
                try { window.LSPDocumentSyncManager.onModelDisposed(editor.getModel()); } catch (e) {}
            }
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

                if (e === '.md' || e === '.markdown') {
                    mdContent.value = result.content;
                    mdLargeFile = result.content.length > 1048576;
                    mdViewMode.value = 'split';
                    viewMode.value = 'markdown';
                    editorTabStore.setViewMode(path, 'markdown');
                    editorTabStore.registerContentProvider(path, () => mdContent.value);
                    await nextTick();
                    renderMarkdownPreview();
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
                            wordWrap: editorTabStore.softWrap ? 'on' : 'off',
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            quickSuggestions: { other: true, comments: false, strings: false },
                            suggestOnTriggerCharacters: true,
                            parameterHints: { enabled: true },
                            hover: { enabled: true },
                            definitionLinksEnabled: true,
                        });
                        editorTabStore.registerEditorInstance(path, editor);
                        editorTabStore.registerContentProvider(path, () => editor ? editor.getValue() : '');
                        editorTabStore.registerViewStateProvider(path, () => editor ? editor.saveViewState() : null);
                        const lang = getLanguage(path);
                        const navDisposables = window.CodeNavigationManager.registerNavigation(editor, lang, path);
                        editorDisposables.push(...navDisposables);
                        if (window.LSPDocumentSyncManager) {
                            window.LSPDocumentSyncManager.onModelCreated(editor.getModel(), lang);
                        }
                        editorDisposables.push(editor.onDidChangeModelContent((event) => {
                            editorTabStore.setDirty(path, true);
                            if (window.LSPDocumentSyncManager) {
                                window.LSPDocumentSyncManager.onModelContentChanged(editor.getModel(), event);
                            }
                        }));
                        if (window.LSPServerStatusManager && window.LSPConfigManager) {
                            const lspConfig = window.LSPConfigManager.getConfig(lang);
                            if (lspConfig && lspConfig.enabled) {
                                const status = window.LSPServerStatusManager.getStatus(lang);
                                if (status === window.LSP_SERVER_STATUS.STOPPED) {
                                    window.LSPServerStatusManager.startServer(lang);
                                }
                            }
                        }
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
        watch(() => editorTabStore.softWrap, (on) => {
            if (viewMode.value === 'edit' && editor) {
                try { editor.updateOptions({ wordWrap: on ? 'on' : 'off' }); } catch (e) {}
            }
        });

        return {
            editorContainer, pdfContainer, docxContainer,
            activePath, fileName, viewMode, previewContent,
            saving, showError, errorMessage, getFileIcon, save,
            settingStore,
            mdViewMode, mdContent, mdRenderedHtml, onMdInput,
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