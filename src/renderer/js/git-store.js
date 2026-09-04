/**
 * ==========================================================================
 * Git Store - 侧边栏 Git 操作面板状态管理
 * ==========================================================================
 * 管理变更列表、diff、提交历史、提交消息、AI 生成、拉取/推送等状态
 * 依赖：window.workspaceAPI.git（preload 暴露）、Pinia（全局 UMD）
 */

// 常量
const TIMELINE_PAGE_SIZE = 50;
const DIFF_VIRTUAL_THRESHOLD = 1000;

const useGitStore = defineStore("gitStore", {
    state: () => ({
        /** @type {{installed:boolean,hasRepo:boolean}|null} git check 结果 */
        checkResult: null,
        /** @type {Array<{file:string,staged:boolean,modified:boolean,status:string}>} 变更文件列表 */
        statusEntries: [],
        /** @type {string|null} 当前选中的变更文件路径 */
        selectedFile: null,
        /** @type {{patch:string,binary:boolean}|null} 当前选中文件的 diff 结果 */
        diffResult: null,
        /** @type {Array<{hash:string,author:string,time:string,message:string}>} 提交历史 */
        logEntries: [],
        /** @type {number} 时间线分页 offset */
        logSkip: 0,
        /** @type {boolean} 时间线是否还有更多 */
        logHasMore: false,
        /** @type {string} 提交消息内容 */
        commitMessage: '',
        /** @type {'manual'|'ai'} 提交消息来源 */
        commitSource: 'manual',
        /** @type {'changes'|'timeline'} 当前视图 */
        view: 'changes',
        /** @type {Object} 各操作的 loading 标志 */
        loading: {
            check: false,
            status: false,
            diff: false,
            stage: false,
            unstage: false,
            commit: false,
            log: false,
            show: false,
            pull: false,
            push: false,
            aiGenerate: false,
        },
        /** @type {Object|null} AI 生成中止控制器 */
        abortController: null,
        /** @type {{files:Array,patch:string}|null} 提交详情查看结果 */
        showResult: null,
        /** @type {string|null} 当前查看详情的提交 hash */
        selectedCommit: null,
        /** @type {boolean} 推送二次确认对话框 */
        pushConfirmDialog: false,
    }),

    getters: {
        /**
         * 按 staged 字段分组为 staged/unstaged 两个数组
         */
        statusGroup(state) {
            const staged = state.statusEntries.filter(e => e.staged);
            const unstaged = state.statusEntries.filter(e => !e.staged);
            return { staged, unstaged };
        },
        /**
         * 是否有激活的 Git 仓库
         */
        hasRepo(state) {
            return state.checkResult?.installed && state.checkResult?.hasRepo;
        },
        /**
         * 是否未安装 Git
         */
        gitNotInstalled(state) {
            return state.checkResult !== null && !state.checkResult.installed;
        },
        /**
         * 是否非 Git 仓库
         */
        notRepo(state) {
            return state.checkResult !== null && state.checkResult.installed && !state.checkResult.hasRepo;
        },
    },

    actions: {
        /**
         * 获取当前工作目录路径
         */
        getDir() {
            const workspaceStore = useWorkspaceStore();
            return workspaceStore.activeWorkspace?.path || null;
        },

        /**
         * 重置全部状态
         */
        reset() {
            this.checkResult = null;
            this.statusEntries = [];
            this.selectedFile = null;
            this.diffResult = null;
            this.logEntries = [];
            this.logSkip = 0;
            this.logHasMore = false;
            this.commitMessage = '';
            this.commitSource = 'manual';
            this.view = 'changes';
            this.showResult = null;
            this.selectedCommit = null;
            this.abortAIGenerate();
            Object.keys(this.loading).forEach(k => { this.loading[k] = false; });
        },

        /**
         * 刷新：检测 Git + 刷新变更列表
         */
        async refresh() {
            const dir = this.getDir();
            if (!dir) {
                this.checkResult = null;
                return;
            }
            this.loading.check = true;
            try {
                const result = await window.workspaceAPI.git.check(dir);
                this.checkResult = result;
                if (result.installed && result.hasRepo) {
                    await this.refreshStatus();
                }
            } catch (err) {
                this.checkResult = { installed: false, hasRepo: false };
            } finally {
                this.loading.check = false;
            }
        },

        /**
         * 刷新变更文件列表
         */
        async refreshStatus() {
            const dir = this.getDir();
            if (!dir) return;
            this.loading.status = true;
            try {
                const result = await window.workspaceAPI.git.status(dir);
                if (result.success) {
                    this.statusEntries = result.entries || [];
                    // 选中文件不再在列表中时清除选中
                    if (this.selectedFile && !this.statusEntries.some(e => e.file === this.selectedFile)) {
                        this.selectedFile = null;
                        this.diffResult = null;
                    }
                } else {
                    useSnackbarStore().showErrorMessage(result.error || 'Failed to load git status');
                }
            } finally {
                this.loading.status = false;
            }
        },

        /**
         * 选择文件并查询 diff
         */
        async selectFile(file) {
            const dir = this.getDir();
            if (!dir) return;
            this.selectedFile = file.file;
            this.loading.diff = true;
            try {
                const entry = this.statusEntries.find(e => e.file === file.file);
                const staged = entry?.staged ?? false;
                const result = await window.workspaceAPI.git.diff(dir, file.file, staged);
                if (result.success) {
                    this.diffResult = { patch: result.patch, binary: result.binary };
                } else {
                    this.diffResult = { patch: '', binary: false };
                    useSnackbarStore().showErrorMessage(result.error || 'Failed to load diff');
                }
            } finally {
                this.loading.diff = false;
            }
        },

        /**
         * 暂存文件
         */
        async stageFiles(files) {
            const dir = this.getDir();
            if (!dir || !files || files.length === 0) return;
            this.loading.stage = true;
            try {
                const result = await window.workspaceAPI.git.stage(dir, files);
                if (result.success) {
                    await this.refreshStatus();
                } else {
                    useSnackbarStore().showErrorMessage(result.error || 'Stage failed');
                }
            } finally {
                this.loading.stage = false;
            }
        },

        /**
         * 取消暂存文件
         */
        async unstageFiles(files) {
            const dir = this.getDir();
            if (!dir || !files || files.length === 0) return;
            this.loading.unstage = true;
            try {
                const result = await window.workspaceAPI.git.unstage(dir, files);
                if (result.success) {
                    await this.refreshStatus();
                } else {
                    useSnackbarStore().showErrorMessage(result.error || 'Unstage failed');
                }
            } finally {
                this.loading.unstage = false;
            }
        },

        /**
         * 全部暂存
         */
        async stageAll() {
            const unstagedFiles = this.statusGroup.unstaged.map(e => e.file);
            if (unstagedFiles.length === 0) return;
            await this.stageFiles(unstagedFiles);
        },

        /**
         * 提交
         */
        async commit() {
            const dir = this.getDir();
            if (!dir) return;
            if (!this.commitMessage.trim()) {
                useSnackbarStore().showWarningMessage('Please enter commit message');
                return;
            }
            if (this.statusGroup.staged.length === 0) {
                useSnackbarStore().showWarningMessage('No staged changes');
                return;
            }
            this.loading.commit = true;
            try {
                const result = await window.workspaceAPI.git.commit(dir, this.commitMessage);
                if (result.success) {
                    useSnackbarStore().showSuccessMessage('Commit successful');
                    this.commitMessage = '';
                    this.commitSource = 'manual';
                    await this.refreshStatus();
                } else {
                    useSnackbarStore().showErrorMessage(result.error || 'Commit failed');
                }
            } finally {
                this.loading.commit = false;
            }
        },

        /**
         * 加载时间线（首次）
         */
        async loadTimeline() {
            const dir = this.getDir();
            if (!dir) return;
            this.loading.log = true;
            this.logSkip = 0;
            try {
                const result = await window.workspaceAPI.git.log(dir, { skip: 0, limit: TIMELINE_PAGE_SIZE });
                if (result.success) {
                    this.logEntries = result.entries || [];
                    this.logSkip = this.logEntries.length;
                    this.logHasMore = this.logEntries.length === TIMELINE_PAGE_SIZE;
                } else {
                    useSnackbarStore().showErrorMessage(result.error || 'Failed to load timeline');
                }
            } finally {
                this.loading.log = false;
            }
        },

        /**
         * 加载更多时间线（滚动分页）
         */
        async loadMoreTimeline() {
            const dir = this.getDir();
            if (!dir || this.loading.log || !this.logHasMore) return;
            this.loading.log = true;
            try {
                const result = await window.workspaceAPI.git.log(dir, { skip: this.logSkip, limit: TIMELINE_PAGE_SIZE });
                if (result.success) {
                    const entries = result.entries || [];
                    this.logEntries.push(...entries);
                    this.logSkip += entries.length;
                    this.logHasMore = entries.length === TIMELINE_PAGE_SIZE;
                }
            } finally {
                this.loading.log = false;
            }
        },

        /**
         * 查看提交详情
         */
        async showCommitDetail(hash) {
            const dir = this.getDir();
            if (!dir) return;
            this.selectedCommit = hash;
            this.loading.show = true;
            try {
                const result = await window.workspaceAPI.git.show(dir, hash);
                if (result.success) {
                    this.showResult = { files: result.files || [], patch: result.patch || '' };
                } else {
                    this.showResult = { files: [], patch: '' };
                    useSnackbarStore().showErrorMessage(result.error || 'Failed to load commit detail');
                }
            } finally {
                this.loading.show = false;
            }
        },

        /**
         * 拉取
         */
        async pull() {
            const dir = this.getDir();
            if (!dir) return;
            this.loading.pull = true;
            try {
                const result = await window.workspaceAPI.git.pull(dir);
                if (result.success && !result.conflicted) {
                    useSnackbarStore().showSuccessMessage('Pull successful');
                    await this.refreshStatus();
                    await this.loadTimeline();
                } else if (result.conflicted) {
                    useSnackbarStore().showWarningMessage('Pull produced conflicts, please resolve manually');
                    await this.refreshStatus();
                } else {
                    useSnackbarStore().showErrorMessage(result.output || 'Pull failed');
                }
            } finally {
                this.loading.pull = false;
            }
        },

        /**
         * 推送（执行实际推送）
         */
        async push() {
            const dir = this.getDir();
            if (!dir) return;
            this.loading.push = true;
            try {
                const result = await window.workspaceAPI.git.push(dir);
                if (result.success) {
                    useSnackbarStore().showSuccessMessage('Push successful');
                    await this.refreshStatus();
                    await this.loadTimeline();
                } else if (result.noUpstream) {
                    useSnackbarStore().showWarningMessage('Current branch has no upstream, please configure first');
                } else if (result.rejected) {
                    useSnackbarStore().showWarningMessage('Push rejected, please pull first');
                } else {
                    useSnackbarStore().showErrorMessage(result.output || 'Push failed');
                }
            } finally {
                this.loading.push = false;
            }
        },

        /**
         * 打开推送二次确认对话框
         */
        openPushConfirm() {
            this.pushConfirmDialog = true;
        },

        /**
         * 取消推送确认
         */
        cancelPushConfirm() {
            this.pushConfirmDialog = false;
        },

        /**
         * AI 生成提交消息（流式）
         */
        async generateAICommitMessage() {
            const dir = this.getDir();
            if (!dir) return;
            if (this.statusGroup.staged.length === 0) {
                useSnackbarStore().showWarningMessage('No staged changes to generate message from');
                return;
            }
            this.loading.aiGenerate = true;
            this.abortController = new AbortController();
            try {
                // 获取已暂存 diff
                const diffResult = await window.workspaceAPI.git.diff(dir, undefined, true);
                if (!diffResult.success || !diffResult.patch || !diffResult.patch.trim()) {
                    useSnackbarStore().showWarningMessage('No staged diff content');
                    return;
                }
                // 流式生成
                this.commitMessage = '';
                this.commitSource = 'ai';
                const chatbotStore = useChatbotStore();
                for await (const delta of generateCommitMessage(diffResult.patch, chatbotStore, this.abortController.signal)) {
                    if (delta?.content) {
                        this.commitMessage += delta.content;
                    }
                }
            } catch (err) {
                if (err?.name === 'AbortError') {
                    // 中止，保留已生成部分
                } else {
                    useSnackbarStore().showErrorMessage('AI generation failed, please input manually or retry');
                }
            } finally {
                this.loading.aiGenerate = false;
                this.abortController = null;
            }
        },

        /**
         * 中止 AI 生成
         */
        abortAIGenerate() {
            if (this.abortController) {
                this.abortController.abort();
                this.abortController = null;
            }
            this.loading.aiGenerate = false;
        },

        /**
         * 切换视图
         */
        switchView(view) {
            this.view = view;
            if (view === 'timeline' && this.logEntries.length === 0) {
                this.loadTimeline();
            }
        },
    },
});

// 监听 activeWorkspace 变化，触发 reset + refresh
// 在 store 定义后通过 watch 设置（需在 app 初始化后生效）
if (typeof watch !== 'undefined' && typeof useWorkspaceStore !== 'undefined') {
    // 延迟绑定，确保 store 已注册
    setTimeout(() => {
        try {
            const store = useGitStore();
            const workspaceStore = useWorkspaceStore();
            watch(() => workspaceStore.activeWorkspace?.id, (newId, oldId) => {
                if (newId !== oldId) {
                    store.reset();
                    store.refresh();
                }
            });
        } catch (e) {
            console.warn('[git-store] watch activeWorkspace failed:', e);
        }
    }, 0);
}