/**
 * ==========================================================================
 * Workspace Store - 工作目录状态管理
 * ==========================================================================
 * 管理工作目录列表、当前激活工作目录、切换流程
 * 依赖：window.workspaceAPI（preload 暴露）、Pinia（全局 UMD）
 */

const useWorkspaceStore = defineStore("workspaceStore", {
    state: () => ({
        /** @type {Array} 工作目录列表 */
        workspaces: [],
        /** @type {string|null} 当前激活工作目录 id */
        activeId: null,
        /** @type {boolean} 是否正在加载 */
        loading: false,
        /** @type {boolean} 是否正在切换工作目录 */
        switching: false,
        /** @type {boolean} 是否已初始化 */
        initialized: false,
    }),

    getters: {
        /** 当前激活的工作目录对象 */
        activeWorkspace(state) {
            return state.workspaces.find(w => w.id === state.activeId) || null;
        },
        /** 失效的工作目录列表 */
        invalidList(state) {
            return state.workspaces.filter(w => w.status === 'invalid');
        },
        /** 有效的工作目录列表 */
        validList(state) {
            return state.workspaces.filter(w => w.status === 'active');
        },
        /** 是否有工作目录 */
        hasWorkspaces(state) {
            return state.workspaces.length > 0;
        },
    },

    actions: {
        /**
         * 加载工作目录列表并恢复激活状态
         */
        async load() {
            this.loading = true;
            try {
                await window.workspaceAPI.validateOnStartup();
                this.workspaces = await window.workspaceAPI.list();

                const savedActiveId = localStorage.getItem('workspace_active_id');
                if (savedActiveId && this.workspaces.find(w => w.id === savedActiveId)) {
                    this.activeId = savedActiveId;
                } else {
                    const active = await window.workspaceAPI.getActive();
                    this.activeId = active ? active.id : null;
                }

                this.initialized = true;
            } catch (err) {
                console.error('Failed to load workspaces:', err);
            } finally {
                this.loading = false;
            }
        },

        /**
         * 创建工作目录
         */
        async create(name, path) {
            const result = await window.workspaceAPI.create(name, path);
            if (result.success) {
                this.workspaces.unshift(result.workspace);
                await this.setActive(result.workspace.id);
            }
            return result;
        },

        /**
         * 重命名工作目录
         */
        async rename(id, name) {
            const result = await window.workspaceAPI.rename(id, name);
            if (result.success) {
                const idx = this.workspaces.findIndex(w => w.id === id);
                if (idx >= 0) {
                    this.workspaces[idx].name = name;
                }
            }
            return result;
        },

        /**
         * 设置激活工作目录
         */
        async setActive(id) {
            const result = await window.workspaceAPI.setActive(id);
            if (result.success) {
                this.activeId = id;
                localStorage.setItem('workspace_active_id', id);
                const idx = this.workspaces.findIndex(w => w.id === id);
                if (idx >= 0) {
                    this.workspaces[idx].last_active = Date.now();
                    this.workspaces[idx].status = 'active';
                }
            } else {
                const idx = this.workspaces.findIndex(w => w.id === id);
                if (idx >= 0) {
                    this.workspaces[idx].status = 'invalid';
                }
            }
            return result;
        },

        /**
         * 刷新当前激活工作目录信息
         */
        async refreshActive() {
            const active = await window.workspaceAPI.getActive();
            if (active) {
                this.activeId = active.id;
                const idx = this.workspaces.findIndex(w => w.id === active.id);
                if (idx >= 0) {
                    this.workspaces[idx] = active;
                }
            }
        },

        /**
         * 更新工作目录路径（用于失效恢复）
         */
        async updatePath(id, newPath) {
            const result = await window.workspaceAPI.updatePath(id, newPath);
            if (result.success) {
                const idx = this.workspaces.findIndex(w => w.id === id);
                if (idx >= 0) {
                    this.workspaces[idx] = result.workspace;
                }
            }
            return result;
        },

        /**
         * 切换到指定路径的工作目录
         * 如果路径已存在工作目录记录，直接激活；否则创建新工作目录
         * @param {string} path - 目标路径
         * @param {string} [name] - 工作目录名称（可选，默认取路径 basename）
         * @param {Function} [onBeforeSwitch] - 切换前回调（如等待在途调用完成）
         * @param {Function} [onAfterSwitch] - 切换后回调（如重建 MCP）
         */
        async switchTo(path, name, onBeforeSwitch, onAfterSwitch) {
            if (this.switching) return { success: false, error: 'already switching' };

            const validation = await window.workspaceAPI.validatePath(path);
            if (!validation.ok) {
                return { success: false, error: validation.reason };
            }

            this.switching = true;
            try {
                if (onBeforeSwitch) {
                    await onBeforeSwitch();
                }

                const os = window.workspaceAPI;
                const existing = this.workspaces.find(w => w.path === path);
                let workspaceId;

                if (existing) {
                    const result = await this.setActive(existing.id);
                    if (!result.success) {
                        return result;
                    }
                    workspaceId = existing.id;
                } else {
                    const wsName = name || path.replace(/\\/g, '/').split('/').pop() || 'workspace';
                    const result = await this.create(wsName, path);
                    if (!result.success) {
                        return result;
                    }
                    workspaceId = result.workspace.id;
                }

                if (onAfterSwitch) {
                    await onAfterSwitch(path);
                }

                return { success: true, workspaceId };
            } catch (err) {
                console.error('Failed to switch workspace:', err);
                return { success: false, error: String(err) };
            } finally {
                this.switching = false;
            }
        },

        /**
         * 获取默认工作目录路径
         */
        async getDefaultPath() {
            return await window.workspaceAPI.getDefaultPath();
        },

        /**
         * 打开目录选择对话框
         */
        async chooseDirectory() {
            return await window.workspaceAPI.chooseDirectory();
        },
    },
});