/**
 * ==========================================================================
 * 应用主逻辑 (Application Main Logic)
 * ==========================================================================
 * 包含文件验证器、图片处理器、文档处理器、多模态适配器、
 * 推理引擎、以及应用初始化逻辑
 */

// ==========================================================================
// 文件验证器 (FileValidator)
// ==========================================================================

/**
 * 文件验证器
 * 验证上传文件的类型、大小和安全性
 */
const FileValidator = {
    /** @type {Object} 接受的文件类型 */
    ACCEPTED_TYPES: {
        image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'],
        document: ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.pdf', '.md', '.csv']
    },
    /** @type {string[]} 禁止的文件扩展名（安全限制） */
    BLOCKED_EXTENSIONS: ['.exe', '.bat', '.sh', '.cmd', '.ps1', '.com', '.vbs', '.js', '.wsf'],
    /** @type {number} 最大文件大小 (10MB) */
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    /** @type {number} 最大附件数量 */
    MAX_ATTACHMENT_COUNT: 10,

    /**
     * 验证文件
     * @param {File} file - 文件对象
     * @returns {{valid: boolean, reason?: string}}
     */
    validate(file) {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (this.BLOCKED_EXTENSIONS.includes(ext)) {
            return { valid: false, reason: 'security_blocked' };
        }
        if (file.type && this.ACCEPTED_TYPES.image.includes(file.type)) {
            if (file.size > this.MAX_FILE_SIZE) {
                return { valid: false, reason: 'file_too_large' };
            }
            return { valid: true };
        }
        const docExts = this.ACCEPTED_TYPES.document;
        if (docExts.includes(ext)) {
            if (file.size > this.MAX_FILE_SIZE) {
                return { valid: false, reason: 'file_too_large' };
            }
            return { valid: true };
        }
        if (file.type && file.type.startsWith('image/')) {
            if (file.size > this.MAX_FILE_SIZE) {
                return { valid: false, reason: 'file_too_large' };
            }
            return { valid: true };
        }
        return { valid: false, reason: 'unsupported_type' };
    },

    /**
     * 检查文件是否重复
     * @param {File} file - 文件对象
     * @param {Array} attachments - 已有附件列表
     * @returns {boolean}
     */
    isDuplicate(file, attachments) {
        return attachments.some(a => a.name === file.name && a.size === file.size);
    },

    /**
     * 获取文件分类
     * @param {File} file - 文件对象
     * @returns {string} 'image' 或 'document'
     */
    getCategory(file) {
        if (file.type && (this.ACCEPTED_TYPES.image.includes(file.type) || file.type.startsWith('image/'))) {
            return 'image';
        }
        return 'document';
    }
};

// ==========================================================================
// 图片处理器 (ImageProcessor)
// ==========================================================================

/** Base64 编码开销比例 */
const BASE64_OVERHEAD_RATIO = 3 / 4;

/**
 * 图片处理器
 * 负责图片压缩、缩略图生成
 */
const ImageProcessor = {
    /** @type {number} 最大宽度 */
    MAX_WIDTH: 2048,
    /** @type {number} 最大高度 */
    MAX_HEIGHT: 2048,
    /** @type {number} 压缩质量 */
    QUALITY: 0.8,
    /** @type {number} 最大压缩后大小 */
    MAX_COMPRESSED_SIZE: 1024 * 1024,

    /**
     * 压缩图片
     * 对 JPEG/PNG 图片进行尺寸和质量压缩，SVG 和 GIF 特殊处理
     * @param {File} file - 图片文件
     * @returns {Promise<string>} Base64 数据 URL
     */
    async compress(file) {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        // SVG 直接读取，不压缩
        if (ext === 'svg') {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error('Failed to read SVG file'));
                reader.readAsDataURL(file);
            });
        }
        // GIF 转为 PNG 静态图
        if (ext === 'gif') {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        try {
                            resolve(canvas.toDataURL('image/png'));
                        } catch (err) {
                            resolve(e.target.result);
                        }
                    };
                    img.onerror = () => resolve(e.target.result);
                    img.src = e.target.result;
                };
                reader.onerror = () => reject(new Error('Failed to read GIF file'));
                reader.readAsDataURL(file);
            });
        }
        // JPEG/PNG 等常规图片压缩
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;
                    let quality = this.QUALITY;
                    // 缩放超大图片
                    if (width > this.MAX_WIDTH || height > this.MAX_HEIGHT) {
                        const scaleFactor = Math.min(this.MAX_WIDTH / width, this.MAX_HEIGHT / height);
                        width = Math.round(width * scaleFactor);
                        height = Math.round(height * scaleFactor);
                        quality = Math.min(quality, quality * scaleFactor);
                    }
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    let dataUrl = canvas.toDataURL('image/jpeg', quality);
                    // 如果仍然太大，逐步降低质量
                    if (dataUrl.length > this.MAX_COMPRESSED_SIZE / BASE64_OVERHEAD_RATIO) {
                        for (let q = quality * 0.7; q > 0.1; q -= 0.1) {
                            dataUrl = canvas.toDataURL('image/jpeg', q);
                            if (dataUrl.length <= this.MAX_COMPRESSED_SIZE / BASE64_OVERHEAD_RATIO) break;
                        }
                    }
                    resolve(dataUrl);
                };
                img.onerror = () => reject(new Error('Image load failed'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('File read failed'));
            reader.readAsDataURL(file);
        });
    },

    /**
     * 生成缩略图
     * @param {File} file - 图片文件
     * @returns {Promise<string>} Base64 缩略图数据 URL
     */
    async generateThumbnail(file) {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (ext === 'svg') {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error('Failed to read SVG'));
                reader.readAsDataURL(file);
            });
        }
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const maxThumb = 200;
                    let w = img.width;
                    let h = img.height;
                    if (w > maxThumb || h > maxThumb) {
                        const scale = Math.min(maxThumb / w, maxThumb / h);
                        w = Math.round(w * scale);
                        h = Math.round(h * scale);
                    }
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = w;
                    canvas.height = h;
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.onerror = () => resolve('');
                img.src = e.target.result;
            };
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
        });
    }
};

// ==========================================================================
// 文档处理器 (DocProcessor)
// ==========================================================================

/**
 * 文档处理器
 * 负责提取文档文本内容
 */
const DocProcessor = {
    /**
     * 提取文档文本
     * 支持 .docx（通过 mammoth）、.txt、.md、.csv
     * @param {File} file - 文档文件
     * @returns {Promise<{text: string, error: string}>}
     */
    async extractText(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'docx') {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                return { text: result.value, error: '' };
            } catch (e) {
                return {
                    text: `[Document: ${file.name}]`,
                    error: `Failed to parse docx: ${e.message || 'unknown error'}`
                };
            }
        }
        if (['txt', 'md', 'csv'].includes(ext)) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve({ text: e.target.result, error: '' });
                reader.onerror = () => resolve({
                    text: `[Document: ${file.name}]`,
                    error: `Failed to read text: ${reader.error?.message || 'read error'}`
                });
                reader.readAsText(file);
            });
        }
        return {
            text: `[Document: ${file.name}]`,
            error: `Format .${ext} is not supported for content extraction; the file name will be sent as context.`
        };
    },

    /**
     * 获取文档类型名称
     * @param {string} extension - 文件扩展名
     * @returns {string} 类型名称
     */
    getDocTypeName(extension) {
        const map = {
            'doc': 'Word', 'docx': 'Word',
            'ppt': 'PowerPoint', 'pptx': 'PowerPoint',
            'xls': 'Excel', 'xlsx': 'Excel',
            'txt': 'Text', 'pdf': 'PDF',
            'md': 'Markdown', 'csv': 'CSV'
        };
        return map[extension] || 'Document';
    }
};

// ==========================================================================
// 多模态适配器 (MultimodalAdapter)
// ==========================================================================

/**
 * 多模态适配器
 * 根据 Provider 类型构建不同格式的多模态消息内容
 */
const MultimodalAdapter = {
    /** @type {string[]} 使用 OpenAI 格式的 Provider */
    OPENAI_PROVIDERS: ['openai-compatible', 'glm', 'qwen', 'kimi', 'minimax', 'doubao-seed'],

    /**
     * 构建多模态消息内容
     * @param {Array} attachments - 附件列表
     * @param {string} text - 文本内容
     * @param {string} providerType - Provider 类型
     * @returns {Array|string} 消息内容
     */
    buildContent(attachments, text, providerType) {
        if (this.OPENAI_PROVIDERS.includes(providerType)) {
            return this.buildOpenAIContent(attachments, text);
        }
        if (providerType === 'anthropic-compatible') {
            return this.buildAnthropicContent(attachments, text);
        }
        return this.buildFallbackContent(attachments, text);
    },

    /**
     * 构建 OpenAI 兼容格式的多模态内容
     * @param {Array} attachments - 附件列表
     * @param {string} text - 文本内容
     * @returns {Array}
     */
    buildOpenAIContent(attachments, text) {
        const content = [];
        const imageAttachments = attachments.filter(a => a.category === 'image' && a.base64Data);
        const docAttachments = attachments.filter(a => a.category === 'document');
        imageAttachments.forEach(a => {
            content.push({ type: 'image_url', image_url: { url: a.base64Data } });
        });
        let textParts = [];
        docAttachments.forEach(a => {
            const ext = a.name.split('.').pop().toLowerCase();
            const docType = DocProcessor.getDocTypeName(ext);
            if (a.textContent && !a.textContent.startsWith('[Document:')) {
                textParts.push(`[${docType} Document: ${a.name}]\n\n${a.textContent}`);
            } else {
                textParts.push(a.textContent || `[${docType} Document: ${a.name}]`);
            }
        });
        if (text) textParts.push(text);
        if (textParts.length > 0) {
            content.push({ type: 'text', text: textParts.join('\n\n') });
        } else if (imageAttachments.length > 0) {
            content.push({ type: 'text', text: imageAttachments.map(a => `[Image: ${a.name}]`).join(', ') });
        }
        return content;
    },

    /**
     * 构建 Anthropic 兼容格式的多模态内容
     * @param {Array} attachments - 附件列表
     * @param {string} text - 文本内容
     * @returns {Array}
     */
    buildAnthropicContent(attachments, text) {
        const content = [];
        const imageAttachments = attachments.filter(a => a.category === 'image' && a.base64Data);
        const docAttachments = attachments.filter(a => a.category === 'document');
        imageAttachments.forEach(a => {
            const matches = a.base64Data.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
                content.push({
                    type: 'image',
                    source: { type: 'base64', media_type: matches[1], data: matches[2] }
                });
            }
        });
        let textParts = [];
        docAttachments.forEach(a => {
            const ext = a.name.split('.').pop().toLowerCase();
            const docType = DocProcessor.getDocTypeName(ext);
            if (a.textContent && !a.textContent.startsWith('[Document:')) {
                textParts.push(`[${docType} Document: ${a.name}]\n\n${a.textContent}`);
            } else {
                textParts.push(a.textContent || `[${docType} Document: ${a.name}]`);
            }
        });
        if (text) textParts.push(text);
        if (textParts.length > 0) {
            content.push({ type: 'text', text: textParts.join('\n\n') });
        }
        return content;
    },

    /**
     * 构建回退格式的多模态内容（纯文本）
     * @param {Array} attachments - 附件列表
     * @param {string} text - 文本内容
     * @returns {string}
     */
    buildFallbackContent(attachments, text) {
        const parts = [];
        attachments.forEach(a => {
            if (a.category === 'image') {
                parts.push(`[Image: ${a.name}]`);
            } else {
                const ext = a.name.split('.').pop().toLowerCase();
                const docType = DocProcessor.getDocTypeName(ext);
                if (a.textContent && !a.textContent.startsWith('[Document:')) {
                    parts.push(`[${docType} Document: ${a.name}]\n\n${a.textContent}`);
                } else {
                    parts.push(a.textContent || `[${docType} Document: ${a.name}]`);
                }
            }
        });
        if (text) parts.push(text);
        return parts.join('\n\n');
    }
};

// ==========================================================================
// 推理引擎 (Inference Engine)
// ==========================================================================

/**
 * 创建对话补全请求
 * 发送消息到 LLM API 并处理流式响应
 * @param {Array} rawconversation - 原始对话数组
 */
const createCompletion = async (rawconversation) => {
    // 移除 assistant 消息中的 reasoning_content 字段
    const conversation = rawconversation.reduce((newConversation, item) => {
        if (item.role === "assistant") {
            const { reasoning_content, ...rest } = item;
            newConversation.push(rest);
        } else {
            newConversation.push(item);
        }
        return newConversation;
    }, []);

    try {
        messageStore.generating = true

        if (!chatbotStore.apiKey) {
            snackbarStore.showErrorMessage('API Key is required');
            return;
        }

        const messages = agentStore.promptMessage(conversation);

        if (chatbotStore.mcp) {
            const tools = await mcpStore.listTools();
            chatbotStore._mcpTools = tools;
        }

        const { headers: authHeaders, body: requestBody, url } = adaptRequest(chatbotStore, messages);

        const body = { ...requestBody };
        if (chatbotStore.mcp && chatbotStore._mcpTools) {
            body.tools = chatbotStore._mcpTools;
            delete chatbotStore._mcpTools;
        }

        const headers = { ...authHeaders };

        const request = {
            headers: headers,
            method: chatbotStore.method,
            body: JSON.stringify(body),
        };

        console.log(`[createCompletion] provider: ${chatbotStore.provider}, url: ${url}`);
        console.log(`body: ${JSON.stringify(body)}`);

        const completion = await fetch(url, request);

        console.log(completion)

        if (!completion.ok) {
            let errorData;
            try {
                errorData = await completion.json();
            } catch (e) {
                errorData = {};
            }
            const errorMsg = normalizeError(chatbotStore.provider, errorData, chatbotStore.apiKey);
            snackbarStore.showErrorMessage(`${completion.status}: ${errorMsg}`);
            return;
        }

        const reader = completion.body?.getReader();
        if (!reader) {
            snackbarStore.showErrorMessage('$vuetify.dataIterator.snackbar.parseStreamFail');
        }

        messageStore.conversation.push({
            content: "",
            reasoning_content: "",
            tool_calls: [],
            role: "assistant",
        });

        let buffer = ''

        await read(reader, messageStore.conversation.at(-1), buffer, chatbotStore.stream);
    } catch (error) {
        console.log(`Request completion error: ${error.message}`)
        snackbarStore.showErrorMessage(error.message);
    } finally {
        console.log("Finish createCompletion")
        messageStore.generating = false
    }
};

/**
 * 递归读取 SSE 流
 * @param {ReadableStreamDefaultReader} reader - 流读取器
 * @param {Object} target - 目标消息对象
 * @param {string} buffer - 缓冲区
 * @param {boolean} stream - 是否流式
 * @param {string} currentEvent - 当前 SSE 事件类型
 */
const read = async (reader, target, buffer, stream, currentEvent) => {
    const decoder = new TextDecoder();
    const { done, value } = await reader.read();

    if (done || !messageStore.generating) {
        messageStore.generating = false;
        return reader.releaseLock();
    }
    const chunks = decoder.decode(value);

    if (stream) {
        let parts = chunks.split('\n')

        if (parts.length === 1) {
            buffer += parts[0]
            return read(reader, target, buffer, stream, currentEvent);
        }

        if (buffer.length > 0) {
            parts[0] = buffer + parts[0];
            buffer = ''
        }

        const last = parts[parts.length - 1];
        if (last && last.length > 0) {
            buffer = parts.pop();
        }

        let event = currentEvent || '';

        parts
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .forEach((line) => {
                const pos = line.indexOf(':');
                const name = line.substring(0, pos);
                if (name === 'event') {
                    event = line.substring(pos + 1).trim();
                    return;
                }
                if (name !== 'data') {
                    return
                }
                const content = line.substring(pos + 1).trim()
                if (content.length === 0) {
                    return
                } else if (content === "[DONE]") {
                    return
                }
                parseJson(content, target, event)
                event = '';
            })

    } else {
        parseJson(chunks, target, '')
    }

    return read(reader, target, buffer, stream, currentEvent);
};

/**
 * 解析 JSON 数据并更新目标消息
 * @param {string} content - JSON 字符串
 * @param {Object} target - 目标消息对象
 * @param {string} sseEvent - SSE 事件类型
 */
const parseJson = (content, target, sseEvent) => {
    try {
        const parsed = JSON.parse(content)
        if (chatbotStore.provider === 'anthropic-compatible' && sseEvent) {
            parsed.type = sseEvent;
        }
        const delta = normalizeSSEChunk(chatbotStore.provider, parsed);
        if (delta) {
            if (target.role === 'assistant') {
                if (delta.content) target.content += delta.content;
                if (delta.reasoning_content) target.reasoning_content += delta.reasoning_content;
                if (delta.tool_calls && delta.tool_calls.length > 0) {
                    parseTool(delta.tool_calls, target);
                }
            }
        }
    } catch (e) {
        console.log(e, content)
        if (target.role === 'assistant') {
            target.content += content;
        }
    }
};

/**
 * 解析工具调用数据
 * 将增量工具调用合并到目标消息的 tool_calls 数组中
 * @param {Array} tools - 工具调用数组
 * @param {Object} target - 目标消息对象
 */
const parseTool = (tools, target) => {
    if (tools) {
        tools.map((tool) => {
            const lastTool = target.tool_calls.at(-1)
            if (lastTool && (!tool.id || lastTool.id == tool.id)) {
                const source = tool.function
                for (const key in source) {
                    if (source[key] === null) {
                        continue;
                    }
                    if (lastTool.function[key]) {
                        lastTool.function[key] += source[key];
                    } else {
                        lastTool.function[key] = source[key];
                    }
                }
            } else {
                target.tool_calls.push(tool)
            }
        })
    }
};

// ==========================================================================
// 应用初始化 (Application Initialization)
// ==========================================================================

const app = createApp({
    components: {
        vuedraggable,
        TuuiChatBox,
        TuuiChatCard,
        'chat-mcp-chat-attachment-bar': ChatAttachmentBar,
        'chat-mcp-chat-attachment-item': ChatAttachmentItem,
        'chat-mcp-chat-thumbnail-strip': ChatThumbnailStrip,
        'chat-mcp-chat-thumbnail-item': ChatThumbnailItem
    },
    setup() {
        // ======================================================================
        // Store 实例化
        // ======================================================================
        const snackbarStore = useSnackbarStore();
        const mcpStore = useMcpStore();
        const agentStore = useAgentStore();
        const settingStore = useSettingStore();
        const resourceStore = useResourceStore();
        const skillStore = useSkillStore();

        // ======================================================================
        // Language Store（依赖 useI18n 的 locale，必须在 setup 内定义）
        // ======================================================================
        const { locale } = useI18n({ useScope: 'global' });

        /**
         * Language Store
         * 管理应用语言设置（中文/英文）
         */
        const useLanguageStore = defineStore("languageStore", {
            state: () => ({
                /** @type {Array} 语言列表 */
                list: [
                    { title: '简体中文', value: 'zhHans', name: 'china' },
                    { title: 'English', value: 'en', name: 'united-states' }
                ]
            }),

            getters: {
                /**
                 * 获取当前语言环境
                 * @returns {string}
                 */
                getLocale: () => {
                    return locale.value
                },
            },

            actions: {
                /**
                 * 切换语言
                 * @param {string} lang - 语言代码
                 */
                change(lang) {
                    locale.value = lang;
                },

                /**
                 * 获取语言对应的国旗图标
                 * @param {string} name - 国家名称
                 * @returns {string} Iconify 图标名称
                 */
                getIcon(name) {
                    return `twemoji:flag-${name}`
                },

                /**
                 * 获取当前语言的国旗图标
                 * @returns {string} Iconify 图标名称
                 */
                getIcon2() {
                    const value = this.getLocale
                    const item = this.list.find(lang => lang.value === value);
                    return `twemoji:flag-${item.name}`
                }
            },
        });

        const languageStore = useLanguageStore();

        const chatbotStore = useChatbotStore();
        runMigrationV2();
        ensureProviderInstances(chatbotStore);
        const messageStore = useMessageStore();
        const historyStore = useHistoryStore();
        const defaultChoiceStore = useDefaultChoiceStore();

        // ======================================================================
        // 拖拽状态
        // ======================================================================
        const isDragging = ref(false);
        const dragCounter = ref(0);

        // ======================================================================
        // 文件选择器引用
        // ======================================================================
        const attachmentAccept = 'image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.pdf,.md,.csv,.svg';
        const filePickerRefLeft = ref(null);
        const filePickerRefRight = ref(null);

        /**
         * 触发文件选择器
         * @param {string} side - 'left' 或 'right'
         */
        function triggerFilePicker(side) {
            if (messageStore.isProcessingFiles) return;
            const refName = side === 'right' ? filePickerRefRight : filePickerRefLeft;
            if (refName.value) refName.value.click();
        }

        /**
         * 处理文件选择器变更
         * @param {Event} event - 变更事件
         * @param {string} side - 'left' 或 'right'
         */
        function onFilePickerChange(event, side) {
            const input = event.target;
            if (!input || !input.files || input.files.length === 0) return;
            const files = Array.from(input.files);
            const result = messageStore.addAttachments(files);
            input.value = '';
            nextTick(() => {
                const textarea = document.querySelector('.message-input textarea');
                if (textarea && document.activeElement !== textarea) {
                    textarea.focus();
                }
            });
            if (result.failures && result.failures.length > 0) {
                const messages = result.failures.map(f => f.userMessage).join('; ');
                snackbarStore.showWarningMessage(messages);
            }
        }

        // ======================================================================
        // 拖拽事件处理
        // ======================================================================

        function onDragEnter(e) {
            if (!hasFileInDataTransfer(e)) return;
            dragCounter.value += 1;
            isDragging.value = true;
        }
        function onDragOver(e) {
            if (!hasFileInDataTransfer(e)) return;
            e.dataTransfer.dropEffect = isDropAllowed(e) ? 'copy' : 'none';
            isDragging.value = true;
        }
        function onDragLeave(e) {
            if (!hasFileInDataTransfer(e)) return;
            dragCounter.value = Math.max(0, dragCounter.value - 1);
            if (dragCounter.value === 0) {
                isDragging.value = false;
            }
        }
        function onDrop(e) {
            isDragging.value = false;
            dragCounter.value = 0;
            const dt = e.dataTransfer;
            if (!dt || !dt.files || dt.files.length === 0) return;
            if (!isDropAllowed(e)) {
                snackbarStore.showWarningMessage('$vuetify.dataIterator.snackbar.unsupportedType');
                return;
            }
            const files = Array.from(dt.files).filter(f => f && f.size >= 0 && f.type !== '');
            if (files.length === 0) {
                snackbarStore.showWarningMessage('$vuetify.dataIterator.snackbar.unsupportedType');
                return;
            }
            const result = messageStore.addAttachments(files);
            if (result.failures && result.failures.length > 0) {
                const messages = result.failures.map(f => f.userMessage).join('; ');
                snackbarStore.showWarningMessage(messages);
            }
        }
        function hasFileInDataTransfer(e) {
            if (!e || !e.dataTransfer) return false;
            const types = e.dataTransfer.types;
            if (!types) return false;
            return Array.from(types).includes('Files');
        }
        function isDropAllowed(e) {
            if (!e || !e.dataTransfer || !e.dataTransfer.items) return false;
            const items = Array.from(e.dataTransfer.items);
            if (items.length === 0) return false;
            return items.every(item => {
                if (item.kind !== 'file') return true;
                const f = item.getAsFile();
                if (!f) return false;
                return FileValidator.validate(f).valid;
            });
        }

        /**
         * 预览附件（图片全屏查看）
         * @param {Object} attachment - 附件对象
         */
        function previewAttachment(attachment) {
            if (attachment.category === 'image' && attachment.base64Data) {
                const dialog = document.createElement('div');
                const img = document.createElement('img');
                img.src = attachment.base64Data;
                img.style.cssText = 'max-width:80vw;max-height:80vh;cursor:pointer;';
                img.onclick = () => dialog.remove();
                dialog.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
                dialog.appendChild(img);
                dialog.onclick = (e) => { if (e.target === dialog) dialog.remove(); };
                document.body.appendChild(dialog);
            }
        }

        // ======================================================================
        // 全局键盘快捷键
        // ======================================================================

        /**
         * 全局键盘事件处理
         * Ctrl+Alt+A: 触发文件选择器
         * @param {KeyboardEvent} e - 键盘事件
         */
        function onGlobalKeydown(e) {
            if (e.ctrlKey && e.altKey && (e.key === 'a' || e.key === 'A')) {
                e.preventDefault();
                const side = settingStore.activePanel === 'chat' ? 'right' : 'left';
                triggerFilePicker(side);
            }
        }

        // ======================================================================
        // Lottie 动画管理
        // ======================================================================
        const lottieAnimation = ref(null);
        const lottieAltAnimation = ref(null);

        const initLottie = () => {
            const lottieContainer = document.getElementById('lottie');
            if (lottieContainer && !lottieAnimation.value) {
                lottieAnimation.value = lottie.loadAnimation({
                    container: lottieContainer,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    path: '../lib/anime/lottie.json'
                });
            }
            const lottieAltContainer = document.getElementById('lottie-alt');
            if (lottieAltContainer && !lottieAltAnimation.value) {
                lottieAltAnimation.value = lottie.loadAnimation({
                    container: lottieAltContainer,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    path: '../lib/anime/lottie.json'
                });
            }
        };

        const destroyLottie = () => {
            if (lottieAnimation.value) {
                lottieAnimation.value.destroy();
                lottieAnimation.value = null;
            }
            if (lottieAltAnimation.value) {
                lottieAltAnimation.value.destroy();
                lottieAltAnimation.value = null;
            }
        };

        const reinitLottie = () => {
            destroyLottie();
            nextTick(() => { initLottie(); });
        };

        // ======================================================================
        // 响应式布局
        // ======================================================================

        const resizeInputBox = () => {
            const inputBox = document.querySelector(".input-box");
            if (!inputBox) return;
            const handleResize = (entries) => {
                for (const entry of entries) {
                    if (entry.target === inputBox) {
                        const chatElement = document.querySelector(".chat-bot");
                        if (chatElement) {
                            chatElement.style.paddingBottom = `${Math.max(entry.contentRect.height, 50)}px`
                        }
                    }
                }
            };
            const resizeObserver = new ResizeObserver(handleResize);
            if (inputBox) {
                resizeObserver.observe(inputBox);
            }
        };

        const resizeAvatar = () => {
            if (window.innerWidth <= 1279) {
                settingStore.avatarSize = 26
            } else {
                settingStore.avatarSize = 36
            }
        };

        // ======================================================================
        // 滚动辅助
        // ======================================================================

        const asyncScrollToBottom = async () => {
            requestAnimationFrame(() => {
                scrollToBottom(document.querySelector(".chat-bot"));
            });
        }

        const scrollToBottom = (element, options = { behavior: "auto" }) => {
            window.scrollTo({
                ...options,
                top: element?.scrollHeight
            });
        };

        // ======================================================================
        // 配置导入导出
        // ======================================================================
        const importFileInput = ref(null)

        const triggerImport = () => {
            const input = importFileInput.value
            if (input) {
                input.value = ''
                input.click()
            }
        }

        const handleImportFile = (event) => {
            const file = event.target.files[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target.result)
                    if (json.chatbotStore) chatbotStore.updateStoreFromJSON(json.chatbotStore)
                    if (json.defaultChoiceStore) defaultChoiceStore.updateStoreFromJSON(json.defaultChoiceStore)
                    snackbarStore.showSuccessMessage('$vuetify.dataIterator.snackbar.importSuccess')
                } catch {
                    snackbarStore.showErrorMessage('$vuetify.dataIterator.snackbar.parseConfigFail')
                }
            }
            reader.readAsText(file)
        }

        const showExportDialog = ref(false)
        const exportSelectedIds = ref([])

        const exportAllSelected = computed(() => chatbotStore.providers.length > 0 && exportSelectedIds.value.length === chatbotStore.providers.length)
        const exportIndeterminate = computed(() => exportSelectedIds.value.length > 0 && exportSelectedIds.value.length < chatbotStore.providers.length)

        const toggleExportAll = () => {
            if (exportAllSelected.value) {
                exportSelectedIds.value = []
            } else {
                exportSelectedIds.value = chatbotStore.providers.map(p => p.id)
            }
        }

        const toggleExportItem = (id) => {
            const idx = exportSelectedIds.value.indexOf(id)
            if (idx >= 0) {
                exportSelectedIds.value.splice(idx, 1)
            } else {
                exportSelectedIds.value.push(id)
            }
        }

        const confirmExport = () => {
            try {
                const selectedProviders = chatbotStore.providers.filter(p => exportSelectedIds.value.includes(p.id))
                const exportData = {
                    chatbotStore: { ...chatbotStore.$state, providers: selectedProviders },
                    defaultChoiceStore: { ...defaultChoiceStore.$state }
                }
                const jsonStr = JSON.stringify(exportData, null, 2)
                const blob = new Blob([jsonStr], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const now = new Date()
                const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
                const a = document.createElement('a')
                a.href = url
                a.download = `chat-mcp-config-${ts}.json`
                a.click()
                URL.revokeObjectURL(url)
                showExportDialog.value = false
                exportSelectedIds.value = []
                snackbarStore.showSuccessMessage('$vuetify.dataIterator.snackbar.exportSuccess')
            } catch {
                snackbarStore.showErrorMessage('$vuetify.dataIterator.snackbar.exportFail')
            }
        }

        const cancelExport = () => {
            showExportDialog.value = false
            exportSelectedIds.value = []
        }

        const getProviderDisplayName = (providerType) => {
            return PROVIDER_DISPLAY_NAMES[providerType] || providerType
        }

        // ======================================================================
        // Provider 编辑状态
        // ======================================================================
        const providerTypes = ref(PROVIDER_TYPES);

        const providerCapabilities = computed(() => {
            return getCapabilities(chatbotStore.provider || 'openai-compatible');
        });

        const onProviderChange = (type) => {
            const preset = getConnectionPreset(type);
            chatbotStore.url = preset.defaultUrl;
            chatbotStore.path = preset.defaultPath;
            chatbotStore.model = preset.defaultModel;
            chatbotStore.authHeaderName = preset.authHeaderName;
            chatbotStore.authPrefix = preset.authPrefix;
        };

        const providerEditMode = ref(null);
        const providerFormData = ref({});
        const providerFormCapabilities = computed(() => getCapabilities(providerFormData.value.provider || 'openai-compatible'));
        const showDeleteDialog = ref(false);
        const deleteTargetId = ref(null);
        const deleteTargetName = ref('');

        const onFormProviderChange = (type) => {
            const preset = getConnectionPreset(type);
            providerFormData.value.url = preset.defaultUrl;
            providerFormData.value.path = preset.defaultPath;
            providerFormData.value.model = preset.defaultModel;
            providerFormData.value.authHeaderName = preset.authHeaderName;
            providerFormData.value.authPrefix = preset.authPrefix;
        };

        const startCreateProvider = () => {
            providerEditMode.value = 'create';
            providerFormData.value = createDefaultInstance('openai-compatible');
        };

        const startEditProvider = (instance) => {
            providerEditMode.value = 'edit';
            providerFormData.value = JSON.parse(JSON.stringify(instance));
        };

        const saveProviderForm = () => {
            const data = providerFormData.value;
            if (!data.provider || !data.apiKey) {
                snackbarStore.showErrorMessage('Provider type and API Key are required');
                return;
            }
            if (providerEditMode.value === 'create') {
                data.id = generateInstanceId();
                if (!data.name) data.name = generateDefaultName(data.provider, chatbotStore.providers.length);
                chatbotStore.addProvider(data);
            } else {
                chatbotStore.updateProvider(data.id, data);
            }
            providerEditMode.value = null;
            providerFormData.value = {};
        };

        const cancelProviderForm = () => {
            providerEditMode.value = null;
            providerFormData.value = {};
        };

        const confirmDeleteProvider = (instance) => {
            deleteTargetId.value = instance.id;
            deleteTargetName.value = instance.name;
            showDeleteDialog.value = true;
        };

        const doDeleteProvider = () => {
            chatbotStore.removeProvider(deleteTargetId.value);
            showDeleteDialog.value = false;
            deleteTargetId.value = null;
            deleteTargetName.value = '';
        };

        // ======================================================================
        // 技能拖拽导入
        // ======================================================================

        /**
         * 处理技能包拖拽导入
         * @param {DragEvent} event - 拖拽事件
         */
        const handleSkillDrop = async (event) => {
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return;

            for (const file of files) {
                const name = file.name.toLowerCase();
                if (name.endsWith('.skill') || name.endsWith('.zip')) {
                    const result = await skillStore.importSkillPack(file);
                    if (result.success) {
                        snackbarStore.showSuccessMessage(result.message);
                    } else {
                        snackbarStore.showErrorMessage(result.message);
                    }
                } else {
                    snackbarStore.showWarningMessage(`Skipped: ${file.name} (not a .skill/.zip file)`);
                }
            }
        };

        // ======================================================================
        // 生命周期钩子
        // ======================================================================

        onMounted(async () => {
            initLottie();
            agentStore.initAgent();
            settingStore.refreshMcpServersList();
            resizeAvatar()
            window.onresize = () => resizeAvatar()
            resizeInputBox()
            window.addEventListener('keydown', onGlobalKeydown);
        });

        onUnmounted(() => {
            destroyLottie();
            window.removeEventListener('keydown', onGlobalKeydown);
        });

        watch(
            () => settingStore.activePanel,
            () => { reinitLottie(); }
        );

        onUpdated(() => {
            initLottie();
        });

        // ======================================================================
        // Watchers
        // ======================================================================

        // 监听消息内容变化，自动滚动到底部
        watch(computed(() => messageStore.conversation.at(-1)?.content),
            (newValue, oldValue) => {
                if (newValue !== oldValue) {
                    asyncScrollToBottom();
                }
            }, { deep: true });

        // 监听 Agent 卡片引用文件变化
        watch(computed(() => agentStore.card?.refFile),
            (newValue, oldValue) => {
                const reader = new FileReader();
                if (agentStore.card?.refFile === null) {
                    agentStore.card.refText = ""
                    return
                }
                if (newValue?.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
                    reader.onload = (event) => {
                        mammoth.extractRawText({ arrayBuffer: event.target.result })
                            .then(function (result) {
                                var text = result.value;
                                agentStore.card.refText = text
                            })
                            .catch(function (error) {
                                console.error(error);
                            });
                    };
                    reader.readAsArrayBuffer(newValue);
                } else if (newValue?.name?.length > 0) {
                    reader.onload = (event) => {
                        agentStore.card.refText = event.target.result
                    };
                    reader.readAsText(newValue);
                }
            }, { deep: true });

        // 字体加载完成
        document.fonts.ready.then(() => {
            settingStore.fontStatus = true
        });

        // ======================================================================
        // 全局重置
        // ======================================================================
        const resetALL = () => {
            historyStore.resetState()
            chatbotStore.resetState()
            defaultChoiceStore.resetState()
        };

        // ======================================================================
        // 返回模板绑定
        // ======================================================================
        return {
            importFileInput,
            triggerImport,
            handleImportFile,
            showExportDialog,
            exportSelectedIds,
            exportAllSelected,
            exportIndeterminate,
            toggleExportAll,
            toggleExportItem,
            confirmExport,
            cancelExport,
            getProviderDisplayName,
            handleSkillDrop,
            isDragging,
            onDragEnter,
            onDragOver,
            onDragLeave,
            onDrop,
            previewAttachment,

            filePickerRefLeft,
            filePickerRefRight,
            triggerFilePicker,
            onFilePickerChange,
            attachmentAccept,

            settingStore,
            resourceStore,
            agentStore,
            snackbarStore,
            mcpStore,
            skillStore,

            messageStore,
            defaultChoiceStore,
            chatbotStore,
            historyStore,

            languageStore,

            resetALL,
            providerTypes,
            providerCapabilities,
            onProviderChange,
            providerEditMode,
            providerFormData,
            providerFormCapabilities,
            showDeleteDialog,
            deleteTargetName,
            onFormProviderChange,
            startCreateProvider,
            startEditProvider,
            saveProviderForm,
            cancelProviderForm,
            confirmDeleteProvider,
            doDeleteProvider,
        };
    }
});

// ==========================================================================
// 应用挂载
// ==========================================================================

const i18n = createI18n({
    legacy: false,
    locale: 'zhHans',
    fallbackLocale: 'zhHans',
    messages,
})

const vuetify = createVuetify({
    locale: {
        adapter: { i18n, useI18n },
    },
})

const pinia = createPinia()
pinia.use(piniaPersist.default)

app.use(i18n)
app.use(vuetify)
app.use(pinia)
app.use(MdEditorV3.MdPreview)

app.mount('#app')
