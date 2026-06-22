/**
 * ==========================================================================
 * Pinia 状态管理 Store 定义
 * ==========================================================================
 * 包含所有应用状态管理：MCP、Agent、Setting、Resource、Skill、
 * Snackbar、Message、History、DefaultChoice、Chatbot、Language
 */

// 从全局库 (UMD/IIFE) 解构常用 API，供本文件及后续脚本（components.js / i18n.js / app.js）使用
// 由于 classic <script> 顶层的 const/let 共享全局词法环境，这里集中声明一次即可
const { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted, onUpdated, defineComponent, createApp } = Vue;
const { defineStore, createPinia, storeToRefs } = Pinia;
const { createI18n, useI18n } = VueI18n;
const { createVuetify } = Vuetify;

// ==========================================================================
// MCP Store - MCP 服务器和工具管理
// ==========================================================================

/**
 * MCP Store
 * 管理 MCP 服务器的连接、工具列表获取、工具调用
 */
const useMcpStore = defineStore("mcpStore", {
    state: () => ({
        /** @type {Array} MCP 工具列表 */
        serverTools: [],
        /** @type {boolean} 是否正在加载工具 */
        loading: true,
        /** @type {Object} MCP 服务器映射 */
        mcpServers: {},
    }),

    getters: {
        /**
         * 获取当前所有 MCP 服务器
         * @returns {Object}
         */
        getServers: (state) => {
            console.log('MCP:', Object.keys(state.mcpServers))
            return state.mcpServers;
        },
    },

    actions: {
        /**
         * 更新 MCP 服务器列表
         */
        updateServers: async function () {
            try {
                this.mcpServers = await window.getServers();
                console.log('Updated MCP servers:', Object.keys(this.mcpServers));
            } catch (error) {
                console.error('Failed to update MCP servers:', error);
                this.mcpServers = {};
            }
        },

        /**
         * 列出所有 MCP 服务器的资源
         * @returns {Array} 资源列表
         */
        listServerResources: async function () {
            await this.updateServers();
            const mcpServers = this.getServers
            const mcpKeys = Object.keys(mcpServers)
            const mcpResources = []
            for (const key of mcpKeys) {
                const resources = mcpServers[key]?.resources
                if (resources) {
                    mcpResources.push({
                        name: key,
                        list: resources.list,
                        templatesList: resources['templates/list']
                    })
                }
            }
            return mcpResources
        },

        /**
         * 加载所有 MCP 服务器的工具列表
         */
        loadTools: function () {
            this.loading = true
            try {
                this.listTools().then((tools) => {
                    this.serverTools = tools.map(tool => {
                        return {
                            name: tool.function.name,
                            description: tool.function.description
                        }
                    })
                    return
                })
            } catch (error) {
                console.error('Failed to load tools:', error);
            } finally {
                this.loading = false;
            }
        },

        /**
         * 列出所有 MCP 服务器的工具
         * @returns {Array|null} 工具列表
         */
        listTools: async function () {
            await this.updateServers();
            const mcpServers = this.getServers
            console.log(`List MCP Servers: ${Object.keys(mcpServers)}`)
            if (!mcpServers) {
                console.warn('No MCP servers available');
                return null
            }
            const mcpKeys = Object.keys(mcpServers)
            console.log(`[listTools] Found ${mcpKeys.length} servers: ${mcpKeys.join(', ')}`);

            const mcpTools = []
            for (const key of mcpKeys) {
                const server = mcpServers[key];
                const toolsListFunction = server?.tools?.list;

                console.log(`[listTools] Processing server "${key}":`, {
                    has_tools: !!server?.tools,
                    is_function: typeof toolsListFunction === 'function',
                    toolsListFunction: toolsListFunction?.toString?.()?.substring(0, 100)
                });

                if (typeof toolsListFunction === 'function') {
                    try {
                        const tools = await toolsListFunction();
                        console.log(`[listTools] Server "${key}" returned tools:`, tools);

                        if (tools && Array.isArray(tools.tools)) {
                            console.log(`[listTools] Server "${key}" has ${tools.tools.length} tools`);
                            for (const tool of tools.tools) {
                                mcpTools.push({
                                    type: 'function',
                                    function: {
                                        name: tool.name,
                                        description: tool.description,
                                        parameters: tool.inputSchema,
                                    }
                                });
                            }
                        } else {
                            console.warn(`[listTools] Server "${key}" returned invalid tools format:`, tools);
                        }
                    } catch (error) {
                        console.error(`[listTools] Error calling tools.list() on server "${key}":`, error);
                    }
                } else {
                    console.warn(`[listTools] Server "${key}" tools.list is not a function. Type: ${typeof toolsListFunction}, Value: ${toolsListFunction}`);
                }
            }

            console.log(`[listTools] Total tools collected: ${mcpTools.length}`, mcpTools);
            return mcpTools
        },

        /**
         * 根据名称获取工具
         * @param {string} tool_name - 工具名称
         * @returns {Object} 包含 server 和 tool 信息的对象
         */
        getTool: async function (tool_name) {
            await this.updateServers();
            const mcpServers = this.getServers;
            console.log(`Get MCP Servers: ${Object.keys(mcpServers)}`)
            const mcpKeys = Object.keys(mcpServers);
            const result = await Promise.any(mcpKeys.map(async (key) => {
                const toolsListFunction = mcpServers[key]?.tools?.list;
                if (typeof toolsListFunction === 'function') {
                    const tools = await toolsListFunction();
                    if (tools && Array.isArray(tools.tools)) {
                        const foundTool = tools.tools.find(tool => tool.name === tool_name);
                        if (foundTool) {
                            return { server: key, tool: foundTool };
                        }
                    }
                }
                throw new Error(`Tool ${tool_name} not found on server ${key}`);
            }));
            return result;
        },

        /**
         * 调用 MCP 工具
         * @param {string} tool_name - 工具名称
         * @param {string} tool_args - JSON 格式的工具参数
         * @returns {Object} 工具调用结果
         */
        callTool: async function (tool_name, tool_args) {
            await this.updateServers();
            const tool = await this.getTool(tool_name)
            if (!tool) {
                return this.packReturn(`Tool name '${tool_name}' not found`)
            }

            let tool_arguments
            try {
                tool_arguments = JSON.parse(tool_args)
            } catch (e) {
                return this.packReturn(`Arguments JSON parse error: '${e}'`)
            }

            const params = {
                name: tool_name,
                arguments: tool_arguments
            }

            const result = await this.getServers[tool.server].tools.call(params)
            return result
        },

        /**
         * 转换 MCP 返回内容项
         * @param {Object} item - 内容项
         * @returns {Object} 转换后的内容项
         */
        convertItem: function (item) {
            if (item.type === "text") {
                return item;
            } else if (item.type === "image") {
                const imageUrl = `data:${item.mimeType};base64,${item.data}`;
                return {
                    type: 'image_url',
                    image_url: { url: imageUrl }
                };
            }
        },

        /**
         * 打包返回文本消息
         * @param {string} string - 消息文本
         * @returns {Object} 标准化的返回格式
         */
        packReturn: (string) => {
            return {
                content: [{
                    type: 'text',
                    text: string
                }]
            }
        },

        /**
         * 添加 MCP 服务器
         * @param {Object} settingStore - Setting Store 实例
         */
        addMcpServer: function (settingStore) {
            if (!settingStore.mcpServerName) {
                console.error('Server name is required');
                alert('Server name is required');
                return;
            }

            try {
                let config = {};
                if (settingStore.mcpServerConfig) {
                    config = JSON.parse(settingStore.mcpServerConfig);
                }

                let serverConfig = {
                    type: settingStore.mcpServerType,
                    ...config
                };

                if (settingStore.mcpServerType === 'http') {
                    if (!settingStore.mcpServerUrl) {
                        console.error('Server URL is required for HTTP/SSE servers');
                        alert('Server URL is required for HTTP/SSE servers');
                        return;
                    }
                    serverConfig = {
                        type: 'http',
                        url: settingStore.mcpServerUrl,
                        port: settingStore.mcpServerPort ? parseInt(settingStore.mcpServerPort) : undefined,
                        transport: 'sse',
                        ...config
                    };
                } else if (settingStore.mcpServerType === 'local') {
                    if (!settingStore.mcpServerCommand) {
                        console.error('Command is required for local servers');
                        alert('Command is required for local servers');
                        return;
                    }
                    const args = settingStore.mcpServerArgs
                        ? settingStore.mcpServerArgs.split('\n').filter(arg => arg.trim())
                        : [];
                    serverConfig = {
                        type: 'local',
                        command: settingStore.mcpServerCommand,
                        args: args.length > 0 ? args : undefined,
                        ...config
                    };
                }

                const dynamicServers = JSON.parse(sessionStorage.getItem('dynamicMcpServers') || '{}');
                dynamicServers[settingStore.mcpServerName] = serverConfig;
                sessionStorage.setItem('dynamicMcpServers', JSON.stringify(dynamicServers));

                console.log('MCP Server configuration added:', settingStore.mcpServerName, serverConfig);
                console.log('Stored in sessionStorage. Current dynamic servers:', Object.keys(dynamicServers));
                console.log(`Successfully added ${settingStore.mcpServerType} MCP server: ${settingStore.mcpServerName}`);
            } catch (error) {
                console.error('Failed to add MCP server:', error);
                alert('Failed to add MCP server: ' + error.message);
            }
        },

        /**
         * 获取服务器列表
         * @returns {Array} 服务器列表
         */
        getServersList: async function () {
            try {
                const clients = await window.listClients();
                console.log('getServersList called, clients from main:', clients);

                const serverList = [];
                if (Array.isArray(clients)) {
                    for (const client of clients) {
                        serverList.push({
                            name: client.name,
                            config: {
                                type: client.type || 'local',
                                url: client.url || undefined,
                                command: client.command || undefined,
                                args: client.args || undefined,
                                message: client.message || undefined
                            },
                            status: 'unknown'
                        });
                    }
                } else if (typeof clients === 'object' && clients !== null) {
                    for (const [name, serverConfig] of Object.entries(clients)) {
                        serverList.push({
                            name: name,
                            config: serverConfig,
                            status: 'unknown'
                        });
                    }
                }

                console.log('Returning server list:', serverList);
                return serverList;
            } catch (error) {
                console.error('Error fetching server list:', error);
                return [];
            }
        },

        /**
         * 测试 MCP 服务器连接
         * @param {string} serverName - 服务器名称
         * @returns {Object} 测试结果 {available, message}
         */
        testServer: async function (serverName) {
            const mcpServers = this.getServers;
            if (!mcpServers || !mcpServers[serverName]) {
                console.error(`Server ${serverName} not found`);
                return { available: false, message: 'Server not found' };
            }

            const serverConfig = mcpServers[serverName];
            console.log(mcpServers);
            console.log(serverName);
            try {
                const toolsListFunction = serverConfig.tools?.list;
                if (typeof toolsListFunction === 'function') {
                    try {
                        const tools = await toolsListFunction();
                        if (tools && Array.isArray(tools.tools)) {
                            return { available: true, message: `Local server available with ${tools.tools.length} tools` };
                        }
                    } catch (err) {
                        console.log(`Local server test failed: ${err.message}`);
                    }
                }

                const url = serverConfig.url;
                console.log(serverConfig)
                if (url) {
                    try {
                        const response = await fetch(url, {
                            method: 'HEAD',
                            timeout: 5000
                        });
                        console.log(response);
                        if (response.ok || response.status === 404) {
                            return { available: true, message: 'HTTP server is reachable' };
                        } else {
                            return { available: false, message: `HTTP server returned status ${response.status}` };
                        }
                    } catch (err) {
                        console.log(`HTTP server test failed: ${err.message}`);
                    }
                }

                return { available: false, message: 'Server is not available (both local and HTTP tests failed)' };
            } catch (error) {
                console.error(`Error testing server ${serverName}:`, error);
                return { available: false, message: `Error: ${error.message}` };
            }
        },

        /**
         * 删除 MCP 服务器
         * @param {string} serverName - 服务器名称
         * @returns {boolean} 是否删除成功
         */
        deleteServer: function (serverName) {
            const mcpServers = this.getServers;
            if (mcpServers && mcpServers[serverName]) {
                delete mcpServers[serverName];
                console.log(`Server ${serverName} deleted`);
                this.loadTools();
                return true;
            }
            return false;
        }
    },
});

// ==========================================================================
// Agent Store - Agent 看板管理
// ==========================================================================

/**
 * Agent Store
 * 管理 Agent 看板的列和卡片，支持拖拽排序
 */
const useAgentStore = defineStore("agentStore", {
    state: () => ({
        /** @type {Object|null} 当前编辑的卡片 */
        card: null,
        /** @type {Array} 看板列 */
        columns: [],
        /** @type {boolean} 编辑对话框是否显示 */
        editDialog: false,
    }),

    persist: {
        enabled: true,
        strategies: [{ storage: sessionStorage }],
    },

    getters: {
        /**
         * 获取拖拽配置选项
         * @returns {Object} vuedraggable 配置
         */
        getDragOption: () => {
            return {
                animation: 200,
                group: "task",
                disabled: false,
                ghostClass: "ghost",
            };
        },
    },

    actions: {
        /**
         * 向指定列添加新卡片
         * @param {Object} column - 目标列
         */
        addCard(column) {
            const { addTitle, key } = column;
            if (!addTitle) return;
            let newCard = {
                id: "_" + Math.random().toString(36).substring(2, 11),
                state: key,
                title: addTitle,
                description: "",
                refFile: null,
                refText: "",
                order: -1,
            };
            column.cards.unshift(newCard);
            column.addTitle = "";
            column.isAddVisible = false;
        },

        /**
         * 删除指定列的卡片
         * @param {Object} column - 列对象
         * @param {number} index - 卡片索引
         */
        deleteCard(column, index) {
            column.cards.splice(index, 1);
        },

        /**
         * 编辑卡片
         * @param {Object} card - 卡片对象
         */
        editCard(card) {
            this.card = { ...card }
            this.editDialog = true;
        },

        /**
         * 保存卡片编辑
         */
        saveCard() {
            const editCard = this.card
            if (editCard) {
                let foundCard = this.columns
                    .flatMap(column => column.cards)
                    .find(card => card.id === this.card.id);
                if (foundCard) {
                    foundCard.title = editCard.title;
                    foundCard.refText = editCard.refText
                    foundCard.refFile = editCard.refFile
                    foundCard.description = editCard.description;
                    this.editDialog = false;
                }
            }
        },

        /**
         * 构建 Prompt 消息 - 将 Agent 卡片和 Skill 提示词组合为系统消息
         * @param {Array} conversation - 当前对话
         * @returns {Array} 包含系统提示词的对话数组
         */
        promptMessage(conversation) {
            const result = this.columns[0].cards
                .filter((item) => {
                    return item.description !== "" || item.refText !== "";
                })
                .map(item => (
                    item.refText ? `${item.description}\n###\n${item.refText}\n###` : item.description
                ))
                .join('\n\n');

            const systemParts = [];
            if (result) {
                systemParts.push(result);
            }
            const _skillStore = useSkillStore();
            if (_skillStore.activeSkillPrompt) {
                systemParts.push(_skillStore.activeSkillPrompt);
            }

            if (systemParts.length > 0) {
                return [{ content: systemParts.join('\n\n---\n\n'), role: "system" }, ...conversation]
            } else {
                return [...conversation]
            }
        },

        /**
         * 初始化 Agent 看板
         */
        initAgent() {
            this.$reset();
            const states = ref(["PROMPT", "BACKUP"]);
            const changeState = (e, colIndex) => {
                console.log(e)
                if (e.added || e.moved) {
                    const column = this.columns[colIndex];
                    const state = column.key;
                    for (let i = 0; i < column.cards.length; i++) {
                        column.cards[i].order = i;
                        column.cards[i].state = state;
                    }
                }
            };

            states.value.forEach((state, index) => {
                this.columns.push({
                    key: state,
                    cards: [],
                    isAddVisible: false,
                    callback: (e) => changeState(e, index),
                });
            });

            this.parseCards([
                {
                    id: 1,
                    title: "Prompt 1",
                    description: "",
                    state: "PROMPT",
                },
            ])
        },

        /**
         * 解析卡片数据到各列
         * @param {Array} cards - 卡片数组
         */
        parseCards(cards) {
            if (!cards) return this.columns.map((column) => (column.cards = []));

            this.columns.forEach((column) => {
                column.cards = cards
                    .filter((card) => card.state === column.key)
                    .sort((a, b) => (a.order < b.order ? -1 : 0));
            });
        },
    },
});

// ==========================================================================
// Setting Store - 应用设置管理
// ==========================================================================

/**
 * Setting Store
 * 管理 UI 设置、MCP 服务器配置、技能管理、Registry 状态等
 */
const useSettingStore = defineStore("settingStore", {
    state: () => ({
        /** @type {number} 输入框行数 */
        inputRow: 1,
        /** @type {number} 头像大小 */
        avatarSize: 24,
        /** @type {boolean} 配置对话框 */
        configDialog: false,
        /** @type {boolean} 历史记录对话框 */
        configHistory: false,
        /** @type {boolean} Agent 对话框 */
        agentDialog: false,
        /** @type {boolean} API Key 显示/隐藏 */
        apiKeyShow: false,
        /** @type {boolean} 工具箱显示 */
        toolboxShow: false,
        /** @type {boolean} 字体状态 */
        fontStatus: false,

        // MCP Server 配置
        /** @type {boolean} 添加 MCP 对话框 */
        addMcpDialog: false,
        /** @type {string} MCP 标签页 */
        mcpTab: 'add-server',
        /** @type {string} MCP 服务器名称 */
        mcpServerName: '',
        /** @type {string} MCP 服务器类型 */
        mcpServerType: 'local',
        /** @type {string} MCP 服务器 URL */
        mcpServerUrl: '',
        /** @type {string} MCP 服务器端口 */
        mcpServerPort: '',
        /** @type {string} MCP 服务器命令 */
        mcpServerCommand: '',
        /** @type {string} MCP 服务器参数 */
        mcpServerArgs: '',
        /** @type {string} MCP 服务器配置 JSON */
        mcpServerConfig: '',

        // JSON 解析模式
        /** @type {string} MCP JSON 配置 */
        mcpJsonConfig: '',
        /** @type {string} MCP JSON 错误 */
        mcpJsonError: '',
        /** @type {Array} 提取的 MCP 服务器 */
        extractedMcpServers: [],
        /** @type {Array} 选中的 MCP 服务器索引 */
        selectedMcpServers: [],

        // MCP 服务器列表管理
        /** @type {Array} 已配置的服务器列表 */
        mcpServersList: [],
        /** @type {Object} 服务器状态映射 */
        mcpServerStatus: {},
        /** @type {Array} 正在测试的服务器 */
        mcpTestingServers: [],

        // MCP 服务器配置查看器
        /** @type {boolean} 配置查看器对话框 */
        mcpConfigViewerDialog: false,
        /** @type {Object|null} 正在查看的服务器 */
        mcpConfigViewerServer: null,

        // 技能管理
        /** @type {boolean} 技能对话框 */
        skillDialog: false,
        /** @type {string} 技能标签页 */
        skillTab: 'registry',
        /** @type {boolean} 技能导入对话框 */
        skillImportDialog: false,
        /** @type {string} 技能导入 JSON */
        skillImportJson: '',
        /** @type {string} 技能导入错误 */
        skillImportError: '',
        /** @type {string} 技能导入标签页 */
        skillImportTab: 'json',
        /** @type {File|null} 技能包文件 */
        skillPackFile: null,
        /** @type {boolean} 技能拖拽悬停 */
        skillDragOver: false,

        // Registry Manager 状态
        /** @type {boolean} Registry 是否运行 */
        registryRunning: false,
        /** @type {string} Registry URL */
        registryUrl: '',
        /** @type {File|null} Registry ZIP 文件 */
        registryZipFile: null,
        /** @type {boolean} Registry 是否处理中 */
        registryProcessing: false,
        /** @type {string} Registry 日志 */
        registryLog: '',
        /** @type {number} Registry 进度 */
        registryProgress: 0,
        /** @type {string} Registry 进度文本 */
        registryProgressText: '',
        /** @type {Object} Registry 通知 */
        registryNotification: {
            show: false,
            message: '',
            type: 'success'
        },

        /** @type {string} 当前活动面板 */
        activePanel: 'chat',
        /** @type {boolean} 面板切换中 */
        panelTransitioning: false,
        /** @type {number} 聊天面板列数 */
        chatPanelCols: 7,
        /** @type {number} 功能面板列数 */
        functionPanelCols: 5
    }),

    getters: {
        /**
         * 左侧列值 - 根据活动面板动态计算
         */
        leftColValue(state) {
            return state.activePanel === 'chat'
                ? state.chatPanelCols
                : state.functionPanelCols;
        },
        /**
         * 右侧列值 - 根据活动面板动态计算
         */
        rightColValue(state) {
            return state.activePanel === 'chat'
                ? state.functionPanelCols
                : state.chatPanelCols;
        }
    },

    actions: {
        /**
         * 切换活动面板（聊天/功能）
         */
        switchPanel() {
            this.panelTransitioning = true;
            this.activePanel = this.activePanel === 'chat' ? 'function' : 'chat';
            setTimeout(() => { this.panelTransitioning = false; }, 300);
        },

        /**
         * 打开配置对话框
         */
        initDialog() {
            this.apiKeyShow = false;
            this.configDialog = true;
        },

        /**
         * 设置输入框行数
         * @param {number} int - 行数
         * @param {number} timeout - 延迟毫秒
         */
        setInputRow(int, timeout) {
            setTimeout(() => {
                this.inputRow = int
            }, timeout);
        },

        /**
         * 重置 MCP 字段
         */
        resetMcpFields() {
            this.mcpServerName = '';
            this.mcpServerType = 'local';
            this.mcpServerUrl = '';
            this.mcpServerPort = '';
            this.mcpServerCommand = '';
            this.mcpServerArgs = '';
            this.mcpServerConfig = '';
        },

        /**
         * 解析并显示 MCP 服务器配置
         */
        parseAndShowMcpServers() {
            this.mcpJsonError = '';
            this.extractedMcpServers = [];
            this.selectedMcpServers = [];

            if (!this.mcpJsonConfig.trim()) {
                this.mcpJsonError = 'Please paste the JSON configuration';
                return;
            }

            try {
                const jsonData = JSON.parse(this.mcpJsonConfig);
                let servers = jsonData.mcpServers || jsonData;

                if (!servers || typeof servers !== 'object') {
                    this.mcpJsonError = 'No valid MCP servers found in the JSON';
                    return;
                }

                for (const [serverName, serverConfig] of Object.entries(servers)) {
                    if (serverConfig && typeof serverConfig === 'object') {
                        if (serverConfig.url) {
                            this.extractedMcpServers.push({
                                name: serverName,
                                type: 'http',
                                url: serverConfig.url,
                                config: serverConfig
                            });
                        } else if (serverConfig.command) {
                            const args = serverConfig.args || [];
                            this.extractedMcpServers.push({
                                name: serverName,
                                type: 'local',
                                command: serverConfig.command,
                                args: Array.isArray(args) ? args : [args],
                                config: serverConfig
                            });
                        }
                    }
                }

                if (this.extractedMcpServers.length === 0) {
                    this.mcpJsonError = 'No valid MCP servers found (each server must have a "url" or "command" property)';
                    return;
                }

                this.selectedMcpServers = this.extractedMcpServers.map((_, idx) => idx);
            } catch (error) {
                this.mcpJsonError = `Invalid JSON: ${error.message}`;
            }
        },

        /**
         * 添加提取的 MCP 服务器
         */
        addExtractedMcpServers() {
            const successCount = this.selectedMcpServers.length;
            const serversToInitialize = [];

            for (const idx of this.selectedMcpServers) {
                const server = this.extractedMcpServers[idx];
                if (server) {
                    this.mcpServerName = server.name;
                    this.mcpServerType = server.type;

                    if (server.type === 'http') {
                        this.mcpServerUrl = server.url;
                        this.mcpServerPort = '';
                        this.mcpServerCommand = '';
                        this.mcpServerArgs = '';
                        const { url, ...additionalConfig } = server.config;
                        if (Object.keys(additionalConfig).length > 0) {
                            this.mcpServerConfig = JSON.stringify(additionalConfig, null, 2);
                        } else {
                            this.mcpServerConfig = '';
                        }
                    } else {
                        this.mcpServerUrl = '';
                        this.mcpServerPort = '';
                        this.mcpServerCommand = server.command;
                        this.mcpServerArgs = server.args.join('\n');
                        const { command, args, ...additionalConfig } = server.config;
                        if (Object.keys(additionalConfig).length > 0) {
                            this.mcpServerConfig = JSON.stringify(additionalConfig, null, 2);
                        } else {
                            this.mcpServerConfig = '';
                        }
                    }

                    useMcpStore().addMcpServer(this);

                    const serializableConfig = JSON.parse(JSON.stringify(server.config));
                    serializableConfig.type = server.type;
                    serversToInitialize.push({
                        name: server.name,
                        config: serializableConfig
                    });
                }
            }

            console.log(`Added ${successCount} MCP server(s)`);

            this.mcpJsonConfig = '';
            this.mcpJsonError = '';
            this.extractedMcpServers = [];
            this.selectedMcpServers = [];
            this.resetMcpFields();
            this.addMcpDialog = false;
            this.initializeServersAndRefresh(serversToInitialize);
        },

        /**
         * 初始化服务器并刷新列表
         * @param {Array} serversToInitialize - 待初始化的服务器列表
         */
        async initializeServersAndRefresh(serversToInitialize) {
            try {
                console.log('Initializing servers dynamically:', serversToInitialize);
                const snackbarStore = useSnackbarStore();

                let successCount = 0;
                let skipCount = 0;

                for (const serverInfo of serversToInitialize) {
                    try {
                        const result = await window.initializeMcpServer(serverInfo.name, serverInfo.config);
                        if (result.success) {
                            console.log(`Server ${serverInfo.name} initialized successfully`, result);
                            successCount++;
                        } else {
                            if (result.message && result.message.includes('already exists')) {
                                console.log(`Server ${serverInfo.name} already initialized, skipping`);
                                skipCount++;
                            } else {
                                console.error(`Failed to initialize server ${serverInfo.name}:`, result.message);
                            }
                        }
                    } catch (error) {
                        console.error(`Error initializing server ${serverInfo.name}:`, error);
                    }
                }

                if (successCount > 0 || skipCount > 0) {
                    console.log(`Initialization complete: ${successCount} new, ${skipCount} already existed. Reloading page to activate...`);
                    let message = `Successfully registered ${successCount} MCP server(s)!`;
                    if (skipCount > 0) {
                        message = `${successCount} new and ${skipCount} existing MCP server(s) ready.`;
                    }
                    message += ' Reloading to activate...';
                    snackbarStore.showSuccessMessage(message);

                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    snackbarStore.showWarningMessage('No servers to initialize');
                }
            } catch (error) {
                console.error('Error during server initialization:', error);
                snackbarStore.showErrorMessage(`Error initializing servers: ${error.message}`);
            }
        },

        /**
         * 刷新 MCP 服务器列表
         */
        refreshMcpServersList() {
            useMcpStore().getServersList().then(serversList => {
                this.mcpServersList = [...serversList];

                for (const server of this.mcpServersList) {
                    if (!this.mcpServerStatus.hasOwnProperty(server.name)) {
                        this.mcpServerStatus[server.name] = 'unknown';
                    }
                }

                console.log('MCP Servers List Updated:', this.mcpServersList);

                const mcpStore = useMcpStore();
                mcpStore.updateServers();
            }).catch(error => {
                console.error('Error refreshing MCP servers list:', error);
            });
        },

        /**
         * 显示 MCP 服务器配置
         * @param {Object} server - 服务器对象
         */
        showMcpServerConfig(server) {
            this.mcpConfigViewerServer = server;
            this.mcpConfigViewerDialog = true;
        },

        /**
         * 测试 MCP 服务器连接
         * @param {string} serverName - 服务器名称
         */
        testMcpServer(serverName) {
            if (this.mcpTestingServers.includes(serverName)) {
                return;
            }

            this.mcpTestingServers.push(serverName);
            this.mcpServerStatus[serverName] = 'testing';

            useMcpStore().testServer(serverName).then(result => {
                this.mcpServerStatus[serverName] = result.available ? 'available' : 'unavailable';
                this.mcpTestingServers = this.mcpTestingServers.filter(s => s !== serverName);

                if (result.message) {
                    console.log(`Server ${serverName}: ${result.message}`);
                }
            }).catch(err => {
                this.mcpServerStatus[serverName] = 'unavailable';
                this.mcpTestingServers = this.mcpTestingServers.filter(s => s !== serverName);
                console.error(`Error testing server ${serverName}:`, err);
            });
        },

        /**
         * 删除 MCP 服务器
         * @param {string} serverName - 服务器名称
         */
        deleteMcpServer(serverName) {
            if (confirm(`Are you sure you want to delete the MCP server "${serverName}"?`)) {
                useMcpStore().deleteServer(serverName);

                const dynamicServers = JSON.parse(sessionStorage.getItem('dynamicMcpServers') || '{}');
                delete dynamicServers[serverName];
                sessionStorage.setItem('dynamicMcpServers', JSON.stringify(dynamicServers));

                window.deleteMcpServer(serverName).then(result => {
                    if (result.success) {
                        console.log(`Server ${serverName} deleted successfully:`, result.message);
                    } else {
                        console.error(`Failed to delete server ${serverName}:`, result.message);
                    }
                }).catch(error => {
                    console.error(`Error deleting server ${serverName}:`, error);
                });

                this.refreshMcpServersList();
                delete this.mcpServerStatus[serverName];
            }
        },

        // ======================================================================
        // Registry Manager 方法
        // ======================================================================

        /**
         * 启动内部 npm 仓库
         */
        async startRegistry() {
            try {
                this.addRegistryLog('正在启动内部npm仓库...');
                const result = await window.registryAPI.start();

                if (result.success) {
                    this.addRegistryLog('内部npm仓库启动成功');
                    this.showRegistryNotification('内部npm仓库启动成功', true);
                } else {
                    this.addRegistryLog(`内部npm仓库启动失败: ${result.message}`);
                    this.showRegistryNotification('内部npm仓库启动失败', false);
                }

                await this.updateRegistryStatus();
            } catch (error) {
                this.addRegistryLog(`启动仓库时出错: ${error.message}`);
                this.showRegistryNotification('启动仓库时出错', false);
            }
        },

        /**
         * 停止内部 npm 仓库
         */
        async stopRegistry() {
            try {
                this.addRegistryLog('正在停止内部npm仓库...');
                const result = await window.registryAPI.stop();

                if (result.success) {
                    this.addRegistryLog('内部npm仓库已停止');
                    this.showRegistryNotification('内部npm仓库已停止', true);
                } else {
                    this.addRegistryLog(`停止内部npm仓库失败: ${result.message}`);
                    this.showRegistryNotification('停止内部npm仓库失败', false);
                }

                await this.updateRegistryStatus();
            } catch (error) {
                this.addRegistryLog(`停止仓库时出错: ${error.message}`);
                this.showRegistryNotification('停止仓库时出错', false);
            }
        },

        /**
         * 更新 Registry 状态
         */
        async updateRegistryStatus() {
            try {
                const status = await window.registryAPI.status();
                this.registryRunning = status.running;
                this.registryUrl = status.url || '';
                this.addRegistryLog(`状态更新 ${status.running ? '运行中' : '已停止'}`);
            } catch (error) {
                this.addRegistryLog(`获取状态失败 ${error.message}`);
                this.showRegistryNotification('获取仓库状态失败', false);
            }
        },

        /**
         * 处理 Registry 依赖包
         */
        async processRegistryDependencies() {
            if (!this.registryZipFile) {
                this.showRegistryNotification('请选择一个zip文件', false);
                return;
            }

            try {
                this.addRegistryLog(`正在处理依赖包 ${this.registryZipFile.name}`);
                this.registryProcessing = true;
                this.updateRegistryProgress(5, '准备处理依赖包...');

                const arrayBuffer = await this.registryZipFile.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);

                this.updateRegistryProgress(10, '正在上传文件...');
                const result = await window.registryAPI.processDependencies({
                    name: this.registryZipFile.name,
                    data: Array.from(uint8Array)
                });

                if (result.success) {
                    this.updateRegistryProgress(100, '依赖包处理完成');
                    this.addRegistryLog('依赖包处理成功');
                    this.showRegistryNotification('依赖包处理成功', true);
                } else {
                    this.addRegistryLog(`依赖包处理失败: ${result.message}`);
                    this.showRegistryNotification('依赖包处理失败', false);
                    this.updateRegistryProgress(0, '处理失败');
                }
            } catch (error) {
                this.addRegistryLog(`处理依赖包时出错: ${error.message}`);
                this.showRegistryNotification('处理依赖包时出错', false);
                this.updateRegistryProgress(0, '处理出错');
            } finally {
                this.registryProcessing = false;
            }
        },

        // ======================================================================
        // Registry Manager 辅助方法
        // ======================================================================

        /**
         * 添加 Registry 日志
         * @param {string} message - 日志消息
         */
        addRegistryLog(message) {
            const timestamp = new Date().toLocaleTimeString();
            this.registryLog += `[${timestamp}] ${message}\n`;
        },

        /**
         * 更新 Registry 进度
         * @param {number} value - 进度值 (0-100)
         * @param {string} text - 进度文本
         */
        updateRegistryProgress(value, text) {
            this.registryProgress = value;
            this.registryProgressText = text;
        },

        /**
         * 显示 Registry 通知
         * @param {string} message - 通知消息
         * @param {boolean} isSuccess - 是否成功
         */
        showRegistryNotification(message, isSuccess = true) {
            this.registryNotification.message = message;
            this.registryNotification.type = isSuccess ? 'success' : 'error';
            this.registryNotification.show = true;
        }
    },
});

// ==========================================================================
// Resource Store - MCP 资源管理
// ==========================================================================

/**
 * Resource Store
 * 管理 MCP 服务器的资源列表和模板
 */
const useResourceStore = defineStore("resourceStore", {
    state: () => ({
        /** @type {boolean} 资源对话框 */
        resourceDialog: false,
        /** @type {string|null} 当前标签页 */
        tab: null,
        /** @type {Array} 资源列表 */
        resourceList: [],
        /** @type {Array} 资源模板列表 */
        resourceTemplatesList: [],
        /** @type {boolean} 模板加载中 */
        loadingTemplates: false,
        /** @type {boolean} 资源加载中 */
        loadingResources: false,
    }),

    actions: {
        /**
         * 加载资源模板
         * @param {Function} resource_function - 资源获取函数
         */
        loadTemplates: function (resource_function) {
            this.loadingTemplates = true
            try {
                resource_function().then((result) => {
                    console.log(result)
                    this.resourceTemplatesList = result.resourceTemplates
                    return
                })
            } catch (error) {
                console.error('Failed to load resource templates:', error);
            } finally {
                this.loadingTemplates = false;
            }
        },

        /**
         * 加载资源列表
         * @param {Function} resource_function - 资源获取函数
         */
        loadResources: function (resource_function) {
            this.loadingResources = true
            try {
                resource_function().then((result) => {
                    console.log(result)
                    this.resourceList = result.resources
                    return
                })
            } catch (error) {
                console.error('Failed to load resources:', error);
            } finally {
                this.loadingResources = false;
            }
        },
    },
});

// ==========================================================================
// Skill Store - 技能管理
// ==========================================================================

/**
 * Skill Store
 * 管理技能的注册、安装、配置、匹配和工作流编排
 */
const useSkillStore = defineStore("skillStore", {
    state: () => ({
        /** @type {Array} 仓库中的技能列表 */
        registrySkills: [],
        /** @type {Array} 已安装的技能列表 */
        installedSkills: [],
        /** @type {string} 技能搜索关键词 */
        skillSearchQuery: '',
        /** @type {string} 技能分类筛选 */
        skillCategoryFilter: 'all',
        /** @type {boolean} 仓库加载中 */
        loadingRegistry: false,
        /** @type {Object|null} 匹配到的技能 */
        matchedSkill: null,
        /** @type {boolean} 技能配置对话框 */
        skillConfigDialog: false,
        /** @type {Object|null} 技能配置目标 */
        skillConfigTarget: null,
        /** @type {string|null} 当前激活的技能 */
        activeSkill: null,
        /** @type {string} 当前激活技能的提示词 */
        activeSkillPrompt: '',
        /** @type {number|null} 匹配防抖定时器 */
        matchDebounceTimer: null,
        /** @type {Array} 工作流步骤 */
        workflowSteps: [],
        /** @type {number|null} 工作流拖拽索引 */
        workflowDragIndex: null,
    }),

    getters: {
        /**
         * 根据搜索和分类筛选后的技能列表
         */
        filteredRegistrySkills(state) {
            let skills = state.registrySkills;
            if (state.skillCategoryFilter !== 'all') {
                skills = skills.filter(s => s.category === state.skillCategoryFilter);
            }
            if (state.skillSearchQuery) {
                const q = state.skillSearchQuery.toLowerCase();
                skills = skills.filter(s =>
                    s.name.toLowerCase().includes(q) ||
                    s.displayName.zh.includes(q) ||
                    s.displayName.en.toLowerCase().includes(q) ||
                    s.tags.some(t => t.toLowerCase().includes(q))
                );
            }
            return skills;
        },

        /**
         * 已安装技能名称列表
         */
        installedSkillNames(state) {
            return state.installedSkills.map(s => s.name);
        },

        /**
         * 技能分类列表
         */
        skillCategories(state) {
            const cats = new Set(state.registrySkills.map(s => s.category));
            return ['all', ...Array.from(cats)];
        },
    },

    actions: {
        /**
         * 获取已安装技能的深拷贝
         * @returns {Array}
         */
        _rawInstalled() {
            return JSON.parse(JSON.stringify(this.installedSkills));
        },

        /**
         * 加载仓库技能列表
         */
        async loadRegistrySkills() {
            this.loadingRegistry = true;
            try {
                this.registrySkills = await window.skillsAPI.listRegistry();
            } catch (error) {
                console.error('Failed to load registry skills:', error);
            } finally {
                this.loadingRegistry = false;
            }
        },

        /**
         * 安装技能
         * @param {string} name - 技能名称
         * @returns {Object} 安装结果
         */
        async installSkill(name) {
            try {
                const result = await window.skillsAPI.install(name, this._rawInstalled());
                if (result.success && result.installedSkills) {
                    this.installedSkills = result.installedSkills;
                }
                return result;
            } catch (error) {
                return { success: false, message: error.message };
            }
        },

        /**
         * 卸载技能
         * @param {string} name - 技能名称
         * @returns {Object} 卸载结果
         */
        async uninstallSkill(name) {
            try {
                const result = await window.skillsAPI.uninstall(name, this._rawInstalled());
                if (result.success && result.installedSkills) {
                    this.installedSkills = result.installedSkills;
                }
                return result;
            } catch (error) {
                return { success: false, message: error.message };
            }
        },

        /**
         * 切换技能启用状态
         * @param {string} name - 技能名称
         * @param {boolean} enabled - 是否启用
         * @returns {Object} 操作结果
         */
        async toggleSkill(name, enabled) {
            try {
                const result = await window.skillsAPI.toggle(name, enabled, this._rawInstalled());
                if (result.success && result.installedSkills) {
                    this.installedSkills = result.installedSkills;
                }
                return result;
            } catch (error) {
                return { success: false, message: error.message };
            }
        },

        /**
         * 更新技能配置
         * @param {string} name - 技能名称
         * @param {Object} config - 配置对象
         * @returns {Object} 操作结果
         */
        async updateSkillConfig(name, config) {
            try {
                const result = await window.skillsAPI.updateConfig(name, config, this._rawInstalled());
                if (result.success && result.installedSkills) {
                    this.installedSkills = result.installedSkills;
                }
                return result;
            } catch (error) {
                return { success: false, message: error.message };
            }
        },

        /**
         * 匹配技能
         * @param {string} input - 用户输入
         * @returns {Object|null} 匹配到的技能
         */
        async matchSkill(input) {
            try {
                this.matchedSkill = await window.skillsAPI.match(input, this._rawInstalled());
                return this.matchedSkill;
            } catch (error) {
                console.error('Failed to match skill:', error);
                return null;
            }
        },

        /**
         * 获取技能系统提示词
         * @param {string} name - 技能名称
         * @returns {string|null} 系统提示词
         */
        async getSkillSystemPrompt(name) {
            try {
                return await window.skillsAPI.getSystemPrompt(name, this._rawInstalled());
            } catch (error) {
                console.error('Failed to get skill system prompt:', error);
                return null;
            }
        },

        /**
         * 记录技能使用
         * @param {string} name - 技能名称
         */
        async recordSkillUsage(name) {
            try {
                const result = await window.skillsAPI.recordUsage(name, this._rawInstalled());
                if (result.installedSkills) {
                    this.installedSkills = result.installedSkills;
                }
            } catch (error) {
                console.error('Failed to record skill usage:', error);
            }
        },

        /**
         * 导出技能
         * @param {string} name - 技能名称
         * @returns {Object|null} 导出结果
         */
        async exportSkill(name) {
            try {
                return await window.skillsAPI.exportSkill(name);
            } catch (error) {
                console.error('Failed to export skill:', error);
                return null;
            }
        },

        /**
         * 导入技能（JSON 格式）
         * @param {string} manifestJson - 技能清单 JSON
         * @returns {Object} 导入结果
         */
        async importSkill(manifestJson) {
            try {
                const result = await window.skillsAPI.importSkill(manifestJson);
                if (result.success) {
                    await this.loadRegistrySkills();
                }
                return result;
            } catch (error) {
                return { success: false, message: error.message };
            }
        },

        /**
         * 导入技能包（.skill 文件）
         * @param {File} file - 技能包文件
         * @returns {Object} 导入结果
         */
        async importSkillPack(file) {
            try {
                if (!file) {
                    return { success: false, message: 'No file selected' };
                }
                const arrayBuffer = await file.arrayBuffer();
                const fileData = {
                    name: file.name,
                    data: Array.from(new Uint8Array(arrayBuffer))
                };
                const result = await window.skillsAPI.importPack(fileData);
                if (result.success) {
                    await this.loadRegistrySkills();
                }
                return result;
            } catch (error) {
                return { success: false, message: error.message || 'Failed to read file' };
            }
        },

        /**
         * 导出技能包
         * @param {Array} skillNames - 技能名称列表
         * @returns {Object} 导出结果
         */
        async exportSkillPack(skillNames) {
            try {
                const result = await window.skillsAPI.exportPack(skillNames);
                if (result.success && result.filePath) {
                    const data = await window.skillsAPI.readFileForExport(result.filePath);
                    if (data && data.length > 0) {
                        const blob = new Blob([new Uint8Array(data)], { type: 'application/zip' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${skillNames.length === 1 ? skillNames[0] : 'skill-pack'}.skill`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }
                }
                return result;
            } catch (error) {
                return { success: false, message: error.message || 'Failed to export' };
            }
        },

        /**
         * 激活技能
         * @param {string} name - 技能名称
         * @returns {boolean} 是否激活成功
         */
        async activateSkill(name) {
            try {
                const prompt = await window.skillsAPI.getSystemPrompt(name, this._rawInstalled());
                if (prompt) {
                    this.activeSkill = name;
                    this.activeSkillPrompt = prompt;
                    await this.recordSkillUsage(name);
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Failed to activate skill:', error);
                return false;
            }
        },

        /**
         * 取消激活技能
         */
        deactivateSkill() {
            this.activeSkill = null;
            this.activeSkillPrompt = '';
        },

        /**
         * 匹配并建议技能（带防抖）
         * @param {string} input - 用户输入
         */
        async matchAndSuggest(input) {
            if (this.matchDebounceTimer) {
                clearTimeout(this.matchDebounceTimer);
            }
            this.matchDebounceTimer = setTimeout(async () => {
                if (!input || input.trim().length < 2) {
                    this.matchedSkill = null;
                    return;
                }
                try {
                    this.matchedSkill = await window.skillsAPI.match(input, this._rawInstalled());
                } catch (error) {
                    console.error('Failed to match skill:', error);
                    this.matchedSkill = null;
                }
            }, 500);
        },

        /**
         * 获取当前激活技能的清单
         * @returns {Object|null}
         */
        getActiveSkillManifest() {
            if (!this.activeSkill) return null;
            return this.registrySkills.find(s => s.name === this.activeSkill) || null;
        },

        /**
         * 重新排序工作流步骤
         * @param {number} fromIndex - 源索引
         * @param {number} toIndex - 目标索引
         */
        reorderWorkflowStep(fromIndex, toIndex) {
            if (fromIndex === null || fromIndex === toIndex) return;
            const step = this.workflowSteps.splice(fromIndex, 1)[0];
            this.workflowSteps.splice(toIndex, 0, step);
        },

        /**
         * 激活工作流 - 将所有步骤的提示词组合
         */
        async activateWorkflow() {
            if (this.workflowSteps.length === 0) return;
            const prompts = [];
            for (const stepName of this.workflowSteps) {
                try {
                    const prompt = await window.skillsAPI.getSystemPrompt(stepName, this._rawInstalled());
                    if (prompt) {
                        prompts.push(`[${stepName}]\n${prompt}`);
                        await this.recordSkillUsage(stepName);
                    }
                } catch (error) {
                    console.error(`Failed to get prompt for workflow step ${stepName}:`, error);
                }
            }
            if (prompts.length > 0) {
                this.activeSkill = this.workflowSteps.join(' → ');
                this.activeSkillPrompt = prompts.join('\n\n---\n\n');
            }
        },
    },

    persist: {
        enabled: true,
        strategies: [{ storage: localStorage }],
        paths: ['installedSkills', 'workflowSteps'],
    },
});

// ==========================================================================
// Snackbar Store - 消息提示管理
// ==========================================================================

/**
 * Snackbar Store
 * 管理全局消息提示（成功、错误、信息、警告）
 */
const useSnackbarStore = defineStore("snackbarStore", {
    state: () => ({
        /** @type {boolean} 是否显示 */
        isShow: false,
        /** @type {string} 消息内容 */
        message: "",
        /** @type {string} 消息类型 */
        type: "",
    }),

    actions: {
        /**
         * 显示消息
         * @param {string} message - 消息内容
         * @param {string} type - 消息类型
         */
        showMessage(message, type = "") {
            this.isShow = true;
            this.message = message;
            this.type = type;
        },

        /** 显示错误消息 */
        showErrorMessage(message) {
            this.showMessage(message, "error");
        },
        /** 显示成功消息 */
        showSuccessMessage(message) {
            this.showMessage(message, "success");
        },
        /** 显示信息消息 */
        showInfoMessage(message) {
            this.showMessage(message, "info");
        },
        /** 显示警告消息 */
        showWarningMessage(message) {
            this.showMessage(message, "warning");
        },

        /**
         * 获取消息类型对应的图标
         * @returns {string} MDI 图标名称
         */
        getIcon() {
            const icon = {
                info: "mdi-information",
                success: "mdi-check-circle",
                error: "mdi-alert-circle",
                warning: "mdi-alert",
            };
            return icon[this.type];
        },
    },
});

// ==========================================================================
// Message Store - 消息和附件管理
// ==========================================================================

/**
 * Message Store
 * 管理聊天消息、附件上传、消息发送和推理流程
 */
const useMessageStore = defineStore("messageStore", {
    state: () => ({
        /** @type {string} 用户输入消息 */
        userMessage: "",
        /** @type {Array} 对话消息列表 */
        conversation: [],
        /** @type {string} Base64 图片数据（旧版） */
        base64: '',
        /** @type {string} 文档内容（旧版） */
        documentContent: '',
        /** @type {string} 文档类型（旧版） */
        documentType: '',
        /** @type {boolean} 是否正在生成回复 */
        generating: false,
        /** @type {Array} 附件列表 */
        attachments: [],
        /** @type {boolean} 是否正在处理文件 */
        isProcessingFiles: false,
        /** @type {number} 正在处理的文件数量 */
        processingCount: 0
    }),

    getters: {
        /**
         * 所有附件是否已处理完毕
         */
        allAttachmentsReady() {
            return this.attachments.length > 0 && this.attachments.every(a => a.status === 'ready');
        },

        /**
         * 附件总编码大小
         */
        totalEncodedSize() {
            const BASE64_OVERHEAD_RATIO = 3 / 4;
            return this.attachments.reduce((sum, a) => {
                if (a.category === 'image' && a.base64Data) {
                    return sum + a.base64Data.length * BASE64_OVERHEAD_RATIO;
                }
                return sum + (a.size || 0);
            }, 0);
        }
    },

    actions: {
        /**
         * 初始化对话
         */
        init() {
            const snackbarStore = useSnackbarStore();
            if (this.conversation.length === 0) {
                snackbarStore.showWarningMessage('$vuetify.dataIterator.snackbar.addfail')
            } else {
                this.conversation = [];
                snackbarStore.showSuccessMessage('$vuetify.dataIterator.snackbar.addnew')
            }
        },

        /**
         * 开始新对话
         */
        startNew() {
            const snackbarStore = useSnackbarStore();
            const historyStore = useHistoryStore();
            if (this.generating) {
                this.generating = false;
            }
            if (this.conversation.length > 0) {
                historyStore.init([...this.conversation]);
                this.conversation = [];
                snackbarStore.showSuccessMessage('$vuetify.dataIterator.snackbar.addnew');
            } else {
                snackbarStore.showWarningMessage('$vuetify.dataIterator.snackbar.addfail');
            }
            nextTick(() => {
                const textarea = document.querySelector('.message-input textarea');
                textarea?.focus();
            });
        },

        /**
         * 停止生成
         */
        stop() {
            this.generating = false;
            useSnackbarStore().showInfoMessage('$vuetify.dataIterator.snackbar.stopped')
        },

        /**
         * 清除所有状态
         */
        clear() {
            this.userMessage = "";
            this.images = [];
            this.documentContent = '';
            this.documentType = '';
            this.attachments = [];
            this.isProcessingFiles = false;
            this.processingCount = 0;
        },

        /**
         * 添加多个附件
         * @param {File[]} files - 文件数组
         * @returns {{accepted: number, failures: Array}}
         */
        addAttachments(files) {
            const failures = [];
            const accepted = [];
            for (const file of files) {
                if (!file || !(file instanceof File)) continue;
                const validation = FileValidator.validate(file);
                if (!validation.valid) {
                    failures.push({ file, reason: validation.reason, userMessage: this._validationMessage(validation.reason) });
                    continue;
                }
                if (this.attachments.length + accepted.length >= FileValidator.MAX_ATTACHMENT_COUNT) {
                    failures.push({ file, reason: 'attachmentLimit', userMessage: this._validationMessage('attachmentLimit') });
                    continue;
                }
                if (FileValidator.isDuplicate(file, this.attachments) || accepted.some(a => a.file.name === file.name && a.file.size === file.size)) {
                    failures.push({ file, reason: 'duplicateFile', userMessage: this._validationMessage('duplicateFile') });
                    continue;
                }
                accepted.push({ file, category: FileValidator.getCategory(file) });
            }
            accepted.forEach(({ file, category }) => this._enqueueAttachment(file, category));
            return { accepted: accepted.length, failures };
        },

        /**
         * 添加单个附件
         * @param {File} file - 文件对象
         * @returns {Object}
         */
        addAttachment(file) {
            return this.addAttachments([file]);
        },

        /**
         * 将附件加入处理队列
         * @param {File} file - 文件对象
         * @param {string} category - 文件分类
         */
        _enqueueAttachment(file, category) {
            const id = crypto.randomUUID();
            const attachment = {
                id,
                file: file,
                name: file.name,
                type: file.type,
                size: file.size,
                category: category,
                thumbnail: '',
                status: 'processing',
                errorMessage: '',
                base64Data: '',
                textContent: ''
            };
            this.attachments.push(attachment);
            this.processingCount += 1;
            this.isProcessingFiles = true;
            (async () => {
                try {
                    if (category === 'image') {
                        const [compressed, thumb] = await Promise.all([
                            ImageProcessor.compress(file),
                            ImageProcessor.generateThumbnail(file)
                        ]);
                        this._updateAttachment(id, a => {
                            a.base64Data = compressed;
                            a.thumbnail = thumb;
                        });
                    } else {
                        const result = await DocProcessor.extractText(file);
                        this._updateAttachment(id, a => {
                            a.textContent = result.text;
                            if (result.error) a.errorMessage = result.error;
                        });
                    }
                    this._updateAttachment(id, a => {
                        a.status = 'ready';
                    });
                } catch (e) {
                    this._updateAttachment(id, a => {
                        a.status = 'error';
                        a.errorMessage = e.message || 'Processing failed';
                    });
                } finally {
                    this.processingCount = Math.max(0, this.processingCount - 1);
                    this.isProcessingFiles = this.processingCount > 0;
                }
            })();
        },

        /**
         * 更新附件属性
         * @param {string} id - 附件 ID
         * @param {Function} mutator - 修改函数
         */
        _updateAttachment(id, mutator) {
            const idx = this.attachments.findIndex(a => a.id === id);
            if (idx < 0) return;
            const next = { ...this.attachments[idx] };
            mutator(next);
            this.attachments.splice(idx, 1, next);
        },

        /**
         * 获取验证失败消息
         * @param {string} reason - 失败原因
         * @returns {string} i18n key
         */
        _validationMessage(reason) {
            const map = {
                'security_blocked': '$vuetify.dataIterator.snackbar.securityBlocked',
                'file_too_large': '$vuetify.dataIterator.snackbar.fileTooLarge',
                'unsupported_type': '$vuetify.dataIterator.snackbar.unsupportedType',
                'attachmentLimit': '$vuetify.dataIterator.snackbar.attachmentLimit',
                'duplicateFile': '$vuetify.dataIterator.snackbar.duplicateFile'
            };
            return map[reason] || reason;
        },

        /**
         * 移除附件
         * @param {string} id - 附件 ID
         */
        removeAttachment(id) {
            const target = this.attachments.find(a => a.id === id);
            if (target && target.status === 'processing') {
                this.processingCount = Math.max(0, this.processingCount - 1);
                this.isProcessingFiles = this.processingCount > 0;
            }
            this.attachments = this.attachments.filter(a => a.id !== id);
        },

        /**
         * 清除所有附件
         */
        clearAttachments() {
            this.attachments = [];
            this.isProcessingFiles = false;
            this.processingCount = 0;
            this.images = [];
        },

        /**
         * 获取附件图标
         * @param {Object} attachment - 附件对象
         * @returns {string} MDI 图标名称
         */
        getAttachmentIcon(attachment) {
            if (attachment.category === 'image') return 'mdi-image';
            return ATTACHMENT_ICON_MAP[attachment.type] || 'mdi-file-document';
        },

        /**
         * 构建多模态消息内容
         * @param {string} text - 文本内容
         * @returns {Array|string} 消息内容
         */
        buildMultimodalContent(text) {
            return MultimodalAdapter.buildContent(this.attachments, text, useChatbotStore().provider);
        },

        /**
         * 处理键盘事件
         * @param {KeyboardEvent} e - 键盘事件
         */
        handleKeydown(e) {
            if (e.key === "Enter" && e.shiftKey) {
                // Shift+Enter 换行，不做处理
            } else if (e.key === "Enter") {
                e.preventDefault();
                this.sendMessage();
            }
        },

        /**
         * 重新发送最后一条消息
         */
        resendMessage() {
            let index = this.conversation.length - 1;
            while (index >= 0 && this.conversation[index].role !== "user") {
                index--;
            }
            if (index >= 0) {
                this.conversation.splice(index + 1);
                this.startInference();
            }
        },

        /**
         * 从指定索引重新生成
         * @param {number} index - 消息索引
         */
        regenerateFromIndex(index) {
            if (index < 0 || index >= this.conversation.length || this.conversation.length === 0) {
                return;
            }
            if (this.conversation[index].role !== 'assistant') {
                return;
            }
            if (this.generating) {
                this.generating = false;
            }
            const removedCount = this.conversation.length - index;
            this.conversation.splice(index);
            console.log(`[regenerateFromIndex] index=${index}, removedCount=${removedCount}`);
            const hasUserMessage = this.conversation.some(msg => msg.role === 'user');
            if (!hasUserMessage) {
                useSnackbarStore().showWarningMessage('$vuetify.dataIterator.snackbar.regenerateNoUser');
                return;
            }
            this.startInference();
        },

        /**
         * 发送消息
         */
        sendMessage() {
            const hasAttachments = this.attachments.length > 0;
            const hasText = !!this.userMessage;
            const hasLegacyFile = !!this.base64 || !!this.documentContent;

            if (!hasText && !hasAttachments && !hasLegacyFile) return;

            if (this.isProcessingFiles) {
                useSnackbarStore().showWarningMessage('$vuetify.dataIterator.snackbar.filesProcessing');
                return;
            }

            if (hasAttachments && this.totalEncodedSize > 20 * 1024 * 1024) {
                useSnackbarStore().showWarningMessage('$vuetify.dataIterator.snackbar.totalSizeExceeded');
                return;
            }

            let content;
            if (hasAttachments) {
                content = this.buildMultimodalContent(this.userMessage);
            } else if (hasLegacyFile) {
                const imageBase64 = this.base64;
                const docContent = this.documentContent;
                let textContent = this.userMessage;
                if (docContent) {
                    const typeMap = {
                        'doc': 'Word', 'docx': 'Word',
                        'ppt': 'PowerPoint', 'pptx': 'PowerPoint',
                        'xls': 'Excel', 'xlsx': 'Excel',
                        'txt': 'Text', 'pdf': 'PDF',
                        'md': 'Markdown', 'csv': 'CSV'
                    };
                    const docType = typeMap[this.documentType] || 'Document';
                    textContent = `[${docType} Document Content]\n\n${docContent}\n\n${this.userMessage}`;
                }
                content = imageBase64
                    ? [
                        { type: "image_url", image_url: { url: imageBase64 } },
                        { type: "text", text: textContent }
                    ] : textContent;
            } else {
                content = this.userMessage;
            }

            this.conversation.push({ role: "user", content });

            if (this.conversation.length == 1) {
                useHistoryStore().init(this.conversation)
            }

            if (hasAttachments) {
                this.clearAttachments();
            } else {
                this.base64 = '';
                this.documentContent = '';
                this.documentType = '';
                this.images = [];
            }
            this.userMessage = '';
            this.startInference();
        },

        /**
         * 开始推理
         */
        startInference: async function () {
            this.clear();
            await createCompletion(this.conversation);
            await this.postToolCall()
        },

        /**
         * 处理工具调用后的逻辑
         */
        postToolCall: async function () {
            const last = this.conversation.at(-1)
            if (!last || !last.tool_calls) {
                return
            }
            if (last.tool_calls.length == 0) {
                delete last.tool_calls
                return
            }
            if (Object.keys(last.tool_calls[0]).length === 0) {
                delete last.tool_calls
                return
            } else {
                let tool_called = false
                console.log(last.tool_calls)

                const callNextTool = async (toolCalls, index) => {
                    if (index >= toolCalls.length) {
                        return;
                    }

                    const tool_call = toolCalls[index];

                    try {
                        const result = await useMcpStore().callTool(
                            tool_call.function.name,
                            tool_call.function.arguments
                        );

                        console.log(result)

                        if (result.content) {
                            this.contentConvert(result.content, tool_call.id).forEach(item => {
                                this.conversation.push(item);
                            });
                            tool_called = true;
                        }

                        await callNextTool(toolCalls, index + 1);
                    } catch (error) {
                        const result = useMcpStore().packReturn(`Error calling tool: ${error}`)
                        this.conversation.push({
                            role: "tool",
                            content: result.content,
                            tool_call_id: tool_call.id
                        });
                        tool_called = true;
                    }
                };

                await callNextTool(last.tool_calls, 0);

                if (tool_called) {
                    this.startInference()
                }
            }
        },

        /**
         * 转换 MCP 工具返回内容为对话消息
         * @param {Array} content - MCP 返回内容
         * @param {string} toolCallId - 工具调用 ID
         * @returns {Array} 对话消息数组
         */
        contentConvert: function (content, toolCallId) {
            const mcpStore = useMcpStore();
            const msg = content.map(item => mcpStore.convertItem(item));
            console.log(msg)
            if (msg.find(item => item.type === 'image_url')) {
                return [{
                    role: "tool",
                    content: mcpStore.packReturn('Image provided in next user message').content,
                    tool_call_id: toolCallId
                }, {
                    role: "user",
                    content: msg,
                }]
            } else {
                return [{
                    role: "tool",
                    content: msg.map(item => item.text).join('\n'),
                    tool_call_id: toolCallId
                }]
            }
        }
    }
});

// ==========================================================================
// History Store - 对话历史管理
// ==========================================================================

/**
 * History Store
 * 管理对话历史的存储、选择和导出
 */
const useHistoryStore = defineStore("historyStore", {
    state: () => ({
        /** @type {Array} 对话历史列表 */
        conversation: [],
    }),

    persist: {
        enabled: true,
        strategies: [{ storage: localStorage }],
    },

    getters: {
        /**
         * 获取当前日期字符串
         * @returns {string}
         */
        getDate: () => {
            const date = new Date().toLocaleString('zh', { timeZoneName: 'short', hour12: false })
            return date
        },
    },

    actions: {
        /** 重置状态 */
        resetState() {
            this.$reset();
        },

        /**
         * 按索引删除历史记录
         * @param {number} index - 索引
         */
        deleteById(index) {
            this.conversation.splice(index, 1);
        },

        /**
         * 初始化历史记录
         * @param {Array} conversation - 对话数组
         */
        init(conversation) {
            this.conversation.unshift({
                id: this.getDate,
                history: conversation
            });
        },

        /**
         * 替换指定历史记录
         * @param {number} id - 索引
         */
        replace(id) {
            this.deleteById(id)
            const messageStore = useMessageStore();
            this.init(messageStore.conversation)
        },

        asyncReplace: async (id) => {
            await nextTick();
            const historyStore = useHistoryStore();
            historyStore.replace(id)
        },

        select(id) {
            if (id < 0 || id >= this.conversation.length) return
            const messageStore = useMessageStore();
            const settingStore = useSettingStore();
            if (messageStore.generating) messageStore.generating = false
            const currentConversation = JSON.parse(JSON.stringify(messageStore.conversation))
            const selectedHistory = JSON.parse(JSON.stringify(this.conversation[id].history))
            if (currentConversation.length === 0) {
                messageStore.conversation = selectedHistory
                this.conversation.splice(id, 1)
            } else {
                this.conversation.unshift({
                    id: this.getDate,
                    history: currentConversation
                })
                messageStore.conversation = selectedHistory
                this.conversation.splice(id + 1, 1)
            }
            settingStore.configHistory = false
        },

        /**
         * 获取历史记录颜色
         * @param {number} id - 索引
         * @returns {string} 颜色名称
         */
        getColor(id) {
            const targetElement = this.conversation[id]?.history.find(element => element.role === "assistant");
            if (targetElement) {
                return "primary"
            } else {
                return "grey"
            }
        },

        /**
         * 按 ID 下载历史记录
         * @param {number} id - 索引
         */
        downloadById(id) {
            const name = this.conversation[id].id.replace(/[/: ]/g, '-');
            this.download(this.conversation[id].history, `history-${name}.json`);
        },

        /** 下载所有历史记录 */
        downloadHistory() {
            this.download(this.conversation, 'history.json')
        },

        /**
         * 下载 JSON 文件
         * @param {Object} json - JSON 数据
         * @param {string} filename - 文件名
         */
        download(json, filename) {
            const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }
    }
});

// ==========================================================================
// Default Choice Store - 默认选项管理
// ==========================================================================

/**
 * Default Choice Store
 * 管理 Provider 配置中的默认选项列表
 */
const useDefaultChoiceStore = defineStore("defaultChoiceStore", {
    state: () => ({
        /** @type {Array} 默认 URL 列表 */
        url: [],
        /** @type {Array} 默认路径列表 */
        path: [
            "/chat/completions",
            "/v1/chat/completions",
        ],
        /** @type {Array} 默认模型列表 */
        model: [
            "Qwen/Qwen3-32B",
            "Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo",
        ],
        /** @type {Array} 认证前缀列表 */
        authPrefix: [],
        /** @type {Array} 最大令牌前缀类型 */
        max_tokens_type: ["max_tokens", "max_completion_tokens", "max_new_tokens"],
        /** @type {Array} 推理努力程度选项 */
        reasoning_efforts: ['false', 'none', 'low', 'medium', 'high']
    }),

    persist: {
        enabled: true,
        strategies: [{ storage: localStorage }],
    },

    actions: {
        /** 重置状态 */
        resetState() {
            this.$reset();
        },

        /**
         * 从 JSON 更新 Store
         * @param {Object} json - JSON 数据
         */
        updateStoreFromJSON(json) {
            this.$reset();
            this.$state = json;
        }
    },
});

// ==========================================================================
// Chatbot Store - Provider 实例管理
// ==========================================================================

/**
 * Chatbot Store
 * 管理多个 Provider 实例的增删改查和切换
 */
const useChatbotStore = defineStore("chatbotStore", {
    state: () => ({
        /** @type {Array} Provider 实例列表 */
        providers: [],
        /** @type {string} 当前活动 Provider ID */
        activeProviderId: '',
        /** @type {string} 当前 Provider 类型 */
        provider: "openai-compatible",
        /** @type {string} API Key */
        apiKey: "",
        /** @type {string} API URL */
        url: "https://api2.aiql.com",
        /** @type {string} API 路径 */
        path: "/chat/completions",
        /** @type {string} 模型名称 */
        model: "Qwen/Qwen3-32B",
        /** @type {string} 认证前缀 */
        authPrefix: "Bearer",
        /** @type {string} 认证头名称 */
        authHeaderName: "Authorization",
        /** @type {string} 内容类型 */
        contentType: "application/json",
        /** @type {string} 最大令牌前缀类型 */
        max_tokens_type: "max_tokens",
        /** @type {string} 最大令牌值 */
        max_tokens_value: "",
        /** @type {string} 温度参数 */
        temperature: "",
        /** @type {string} Top P 参数 */
        top_p: "",
        /** @type {string} HTTP 方法 */
        method: "POST",
        /** @type {boolean} 是否流式输出 */
        stream: true,
        /** @type {boolean} 是否启用思考 */
        thinking: true,
        /** @type {string|null} 推理努力程度 */
        reasoning_effort: null,
        /** @type {boolean} 是否启用 MCP */
        mcp: true,
        /** @type {number|null} 随机种子 */
        seed: null,
        /** @type {number|null} 频率惩罚 */
        frequency_penalty: null,
        /** @type {boolean} 是否屏蔽敏感信息 */
        mask_sensitive_info: false
    }),

    persist: {
        enabled: true,
        strategies: [{ storage: localStorage }],
    },

    getters: {
        /**
         * 获取当前活动的 Provider 实例
         */
        activeProvider(state) {
            return state.providers.find(p => p.id === state.activeProviderId);
        },
    },

    actions: {
        /**
         * 将实例字段应用到 Store
         * @param {Object} instance - Provider 实例
         */
        _applyInstanceToStore(instance) {
            applyInstanceToStore(this, instance);
        },

        /**
         * 切换 Provider
         * @param {string} id - Provider ID
         */
        switchProvider(id) {
            const instance = this.providers.find(p => p.id === id);
            if (!instance) return;
            this.activeProviderId = id;
            this._applyInstanceToStore(instance);
        },

        /**
         * 添加 Provider 实例
         * @param {Object} instance - Provider 实例
         * @returns {string} 新实例 ID
         * @throws {Error} 超过最大数量限制
         */
        addProvider(instance) {
            if (this.providers.length >= 20) {
                throw new Error('已达到最大实例数量限制（20）');
            }
            this.providers.push(instance);
            this.switchProvider(instance.id);
            return instance.id;
        },

        /**
         * 更新 Provider 实例
         * @param {string} id - Provider ID
         * @param {Object} updated - 更新的字段
         */
        updateProvider(id, updated) {
            const idx = this.providers.findIndex(p => p.id === id);
            if (idx === -1) return;
            this.providers[idx] = { ...this.providers[idx], ...updated };
            if (id === this.activeProviderId) {
                this._applyInstanceToStore(this.providers[idx]);
            }
        },

        /**
         * 删除 Provider 实例
         * @param {string} id - Provider ID
         * @throws {Error} 至少需要保留一个实例
         */
        removeProvider(id) {
            if (this.providers.length <= 1) {
                throw new Error('至少需要保留一个 Provider 实例');
            }
            const idx = this.providers.findIndex(p => p.id === id);
            if (idx === -1) return;
            const wasActive = id === this.activeProviderId;
            this.providers.splice(idx, 1);
            if (wasActive) {
                const newIdx = Math.min(idx, this.providers.length - 1);
                this.switchProvider(this.providers[newIdx].id);
            }
        },

        /** 重置状态 */
        resetState() {
            this.$reset();
            useDefaultChoiceStore().resetState()
        },

        /**
         * 从 JSON 更新 Store
         * @param {Object} json - JSON 数据
         */
        updateStoreFromJSON(json) {
            this.$reset();
            this.$state = json;
        }
    },
});


