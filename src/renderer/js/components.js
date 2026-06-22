/**
 * ==========================================================================
 * Vue 组件定义
 * ==========================================================================
 * 包含所有自定义 Vue 组件：图片对话框、附件、缩略图、聊天卡片、聊天框
 */

// ==========================================================================
// 附件图标映射
// ==========================================================================

/**
 * 文件类型到 MDI 图标的映射
 * @type {Object<string, string>}
 */
const ATTACHMENT_ICON_MAP = {
    'application/pdf': 'mdi-file-pdf-box',
    'application/msword': 'mdi-file-word-box',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'mdi-file-word-box',
    'application/vnd.ms-excel': 'mdi-file-excel-box',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'mdi-file-excel-box',
    'application/vnd.ms-powerpoint': 'mdi-file-powerpoint-box',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'mdi-file-powerpoint-box',
    'text/plain': 'mdi-file-document-outline',
    'text/markdown': 'mdi-language-markdown',
    'text/csv': 'mdi-file-delimited',
};

/**
 * 文件类型到图标颜色的映射
 * @type {Object<string, string>}
 */
const ATTACHMENT_ICON_COLOR_MAP = {
    'application/pdf': 'red',
    'application/msword': 'blue',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'blue',
    'application/vnd.ms-excel': 'green',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'green',
    'application/vnd.ms-powerpoint': 'orange',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'orange',
    'text/plain': 'grey',
    'text/markdown': 'teal',
    'text/csv': 'green',
};

// ==========================================================================
// TuuiImgDialog - 图片对话框组件
// ==========================================================================

/**
 * 图片对话框组件
 * 点击缩略图后以全屏模式查看图片
 * @props {string} src - 图片 URL
 */
const TuuiImgDialog = {
    template: '#tuui-img-dialog-template',
    props: { src: { type: String, required: true } }
};

// ==========================================================================
// ChatAttachmentItem - 附件项组件
// ==========================================================================

/**
 * 附件项组件
 * 显示单个附件的缩略图、名称和状态
 * @props {Object} attachment - 附件对象
 * @emits remove - 移除附件
 * @emits preview - 预览附件
 */
const ChatAttachmentItem = {
    template: '#chat-mcp-chat-attachment-item-template',
    props: {
        attachment: { type: Object, required: true }
    },
    emits: ['remove', 'preview'],
    methods: {
        /**
         * 获取文档类型对应的图标
         * @param {string} type - MIME 类型
         * @returns {string} MDI 图标名称
         */
        getDocIcon(type) {
            return ATTACHMENT_ICON_MAP[type] || 'mdi-file-document';
        },
        /**
         * 获取文档类型对应的图标颜色
         * @param {string} type - MIME 类型
         * @returns {string} 颜色名称
         */
        getDocIconColor(type) {
            return ATTACHMENT_ICON_COLOR_MAP[type] || 'grey';
        }
    }
};

// ==========================================================================
// ChatAttachmentBar - 附件栏组件
// ==========================================================================

/**
 * 附件栏组件
 * 水平排列显示所有附件
 * @props {Array} attachments - 附件列表
 * @emits remove - 移除附件
 * @emits preview - 预览附件
 * @emits clear - 清除所有附件
 */
const ChatAttachmentBar = {
    template: '#chat-mcp-chat-attachment-bar-template',
    components: { 'chat-mcp-chat-attachment-item': ChatAttachmentItem },
    props: {
        attachments: { type: Array, required: true }
    },
    emits: ['remove', 'preview', 'clear'],
};

// ==========================================================================
// ChatThumbnailItem - 缩略图项组件
// ==========================================================================

/**
 * 缩略图项组件
 * 输入框内的单个缩略图，支持悬停显示移除按钮
 * @props {Object} attachment - 附件对象
 * @emits remove - 移除附件
 */
const ChatThumbnailItem = {
    template: '#chat-mcp-chat-thumbnail-item-template',
    props: {
        attachment: { type: Object, required: true }
    },
    emits: ['remove'],
    methods: {
        /**
         * 获取文档类型对应的图标
         * @param {string} type - MIME 类型
         * @returns {string} MDI 图标名称
         */
        getDocIcon(type) {
            return ATTACHMENT_ICON_MAP[type] || 'mdi-file-document';
        },
        /**
         * 获取文档类型对应的图标颜色
         * @param {string} type - MIME 类型
         * @returns {string} 颜色名称
         */
        getDocIconColor(type) {
            return ATTACHMENT_ICON_COLOR_MAP[type] || 'grey';
        },
        /**
         * 格式化文件大小
         * @param {number} bytes - 字节数
         * @returns {string} 格式化后的大小字符串
         */
        formatSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }
    }
};

// ==========================================================================
// ChatThumbnailStrip - 缩略图条组件
// ==========================================================================

/**
 * 缩略图条组件
 * 输入框内水平滚动的缩略图条，支持鼠标滚轮横向滚动
 * 当缩略图超出可见区域时显示溢出计数
 * @props {Array} attachments - 附件列表
 * @emits remove - 移除附件
 */
const ChatThumbnailStrip = {
    template: '#chat-mcp-chat-thumbnail-strip-template',
    components: { 'chat-mcp-chat-thumbnail-item': ChatThumbnailItem },
    props: {
        attachments: { type: Array, required: true }
    },
    emits: ['remove'],
    data() {
        return {
            /** @type {number} 溢出缩略图数量 */
            overflowCount: 0,
            /** @type {ResizeObserver|null} 尺寸观察器 */
            resizeObserver: null
        };
    },
    watch: {
        attachments: {
            handler() {
                this.$nextTick(() => {
                    this.updateOverflowCount();
                    this.scrollToEnd();
                });
            },
            deep: true
        }
    },
    mounted() {
        this.resizeObserver = new ResizeObserver(() => {
            this.updateOverflowCount();
        });
        if (this.$refs.stripRef) {
            this.resizeObserver.observe(this.$refs.stripRef);
        }
    },
    beforeUnmount() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    },
    methods: {
        /**
         * 处理鼠标滚轮事件，实现横向滚动
         * @param {WheelEvent} e - 滚轮事件
         */
        onWheel(e) {
            const container = this.$refs.scrollContainerRef;
            if (container) {
                container.scrollLeft += e.deltaY;
            }
        },
        /**
         * 更新溢出缩略图计数
         */
        updateOverflowCount() {
            const container = this.$refs.scrollContainerRef;
            if (!container) { this.overflowCount = 0; return; }
            const visibleWidth = this.$refs.stripRef ? this.$refs.stripRef.clientWidth : 0;
            const totalWidth = container.scrollWidth;
            if (totalWidth <= visibleWidth) {
                this.overflowCount = 0;
                return;
            }
            const itemWidth = 36;
            const hiddenWidth = totalWidth - visibleWidth;
            this.overflowCount = Math.ceil(hiddenWidth / itemWidth);
        },
        /**
         * 滚动到末尾（新附件添加时）
         */
        scrollToEnd() {
            const container = this.$refs.scrollContainerRef;
            if (container) {
                container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
            }
        }
    }
};

// ==========================================================================
// TuuiChatCard - 聊天卡片组件
// ==========================================================================

/**
 * 聊天卡片组件
 * 单条消息的卡片容器，支持复制、编辑、重新生成等操作
 * @props {number} index - 消息索引
 * @props {number} range - 操作范围（删除时）
 * @props {Object} messages - 消息列表
 * @props {boolean} showContent - 是否显示内容切换按钮
 * @props {boolean} showDelete - 是否显示删除按钮
 * @props {boolean} showReduce - 是否显示缩减按钮
 * @props {boolean} showModify - 是否显示编辑按钮
 * @props {boolean} showCopy - 是否显示复制按钮
 * @props {boolean} showRegenerate - 是否显示重新生成按钮
 * @props {boolean} generating - 是否正在生成
 * @emits regenerate - 重新生成事件
 */
const TuuiChatCard = {
    template: '#tuui-chat-card-template',
    emits: ['regenerate'],
    props: {
        index: { type: Number, required: true },
        range: { type: Number, required: false, default: 1 },
        messages: { type: Object, required: true },
        showContent: { type: Boolean, default: false },
        showDelete: { type: Boolean, default: true },
        showReduce: { type: Boolean, default: true },
        showModify: { type: Boolean, default: false },
        showCopy: { type: Boolean, default: true },
        showRegenerate: { type: Boolean, default: false },
        generating: { type: Boolean, default: false },
    },
    setup(props, { emit }) {
        const showcontent = ref(false);
        const showmodify = ref(false);
        const snackbarStore = useSnackbarStore();

        /**
         * 复制消息内容到剪贴板
         * @param {Object} msg - 消息对象
         */
        const copyToClipboard = async (msg) => {
            let textToCopy = '';
            try {
                if (typeof msg.content === 'string') {
                    textToCopy = msg.content;
                } else if (Array.isArray(msg.content)) {
                    for (const item of msg.content) {
                        if (item.type === 'text' && typeof item.text === 'string') {
                            textToCopy = item.text;
                        }
                    }
                }
                await navigator.clipboard.writeText(textToCopy);
                snackbarStore.showSuccessMessage('$vuetify.dataIterator.snackbar.copied')
            } catch (err) {
                snackbarStore.showErrorMessage(err)
            }
        };

        /**
         * 从指定索引重新生成
         * @param {number} index - 消息索引
         */
        const regenerateFromIndex = (index) => {
            emit('regenerate', index);
        };

        return {
            copyToClipboard,
            showcontent,
            showmodify,
            regenerateFromIndex,
        };
    }
}; // 对象字面量闭合：使用 }; 而非 });（}); 仅用于 defineComponent() 等函数调用）

// ==========================================================================
// TuuiChatBox - 聊天框组件
// ==========================================================================

/**
 * 聊天框组件
 * 消息列表的主容器，将消息按角色分组显示
 * 支持 user、assistant、tool 三种消息类型的分组
 * @props {Array} messages - 消息列表
 * @props {number} size - 头像大小
 * @props {string} language - 语言环境
 * @props {boolean} generating - 是否正在生成
 * @emits regenerate - 重新生成事件
 */
const TuuiChatBox = {
    template: '#tuui-chat-box-template',
    emits: ['regenerate'],
    components: {
        TuuiImgDialog,
        TuuiChatCard,
    },
    props: {
        messages: { type: Array, required: true },
        size: { type: Number },
        language: { type: String },
        generating: { type: Boolean, default: false }
    },
    setup(props) {
        const dialogs = reactive({});

        /**
         * 将消息按角色分组
         * - user 消息：独立一组
         * - assistant 消息（无 tool_calls）：独立一组
         * - tool 相关消息（assistant 有 tool_calls 或 tool 角色）：合并为一组
         * @returns {Array} 分组后的消息列表
         */
        const groupMessages = computed(() => {
            const groups = [];
            props.messages.forEach((message, index) => {
                if (message.role === 'user') {
                    groups.push({
                        index: index,
                        group: 'user',
                        message: message
                    })
                } else if ((message.role === 'assistant') && (!message.tool_calls || message.tool_calls.length == 0)) {
                    groups.push({
                        index: index,
                        group: 'assistant',
                        message: message
                    })
                } else {
                    const lastGroup = groups.at(-1)
                    if (lastGroup?.group == 'tool') {
                        lastGroup.messages.push(message)
                        dialogs[lastGroup.tab] = lastGroup.length
                        lastGroup.length += 1
                    } else {
                        const id = message.tool_call_id || message.tool_calls[0]?.id
                        groups.push({
                            index: index,
                            group: 'tool',
                            tab: id,
                            messages: [message],
                            length: 1
                        })
                        dialogs[id] = 0
                    }
                }
            })
            return groups
        });

        return {
            dialogs,
            groupMessages
        }
    }
};
