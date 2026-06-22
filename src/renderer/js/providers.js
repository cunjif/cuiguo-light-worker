/**
 * ==========================================================================
 * Provider 抽象层 (Provider Abstraction Layer)
 * ==========================================================================
 * 负责管理多种 LLM Provider 的注册、请求转换、响应解析和错误处理。
 * 支持 OpenAI、Anthropic、GLM、Qwen、Kimi、MiniMax、Doubao 等 Provider。
 */

/**
 * 支持的 Provider 类型列表
 * @type {string[]}
 */
const PROVIDER_TYPES = ['openai-compatible', 'anthropic-compatible', 'glm', 'qwen', 'kimi', 'minimax', 'doubao-seed'];

/**
 * Provider 注册表，存储所有已注册的 Provider 配置
 * @type {Map<string, Object>}
 */
const providerRegistry = new Map();

/**
 * 注册一个新的 Provider
 * @param {Object} config - Provider 配置对象
 * @param {string} config.type - Provider 类型标识
 * @param {Object} config.connectionPreset - 连接预设（默认URL、路径、模型等）
 * @param {Object} config.capabilities - 能力声明（stream、toolCall、reasoning 等）
 * @param {Function} config.requestTransformer - 请求体转换函数
 * @param {Function} config.responseTransformer - SSE 响应块转换函数
 * @param {Function} config.errorTransformer - 错误响应转换函数
 * @throws {Error} 当缺少必需字段或类型重复时抛出
 */
function registerProvider(config) {
    const required = ['type', 'connectionPreset', 'capabilities', 'requestTransformer', 'responseTransformer', 'errorTransformer'];
    for (const key of required) {
        if (config[key] === undefined || config[key] === null) {
            throw new Error(`Provider registration failed: missing required field "${key}" for type "${config.type}"`);
        }
    }
    if (providerRegistry.has(config.type)) {
        throw new Error(`Provider registration failed: duplicate type "${config.type}"`);
    }
    providerRegistry.set(config.type, config);
}

/**
 * 默认能力声明
 * @type {Object}
 */
const DEFAULT_CAPABILITIES = {
    streamSupported: true,
    toolCallSupported: true,
    reasoningSupported: true,
    seedSupported: false
};

/**
 * 默认连接预设（OpenAI 格式）
 * @type {Object}
 */
const DEFAULT_CONNECTION_PRESET = {
    defaultUrl: 'https://api.openai.com',
    defaultPath: '/v1/chat/completions',
    defaultModel: 'gpt-4o',
    authHeaderName: 'Authorization',
    authPrefix: 'Bearer '
};

/**
 * 默认 Provider（OpenAI Compatible），作为回退方案
 * @type {Object}
 */
const DEFAULT_PROVIDER = {
    type: 'openai-compatible',
    connectionPreset: DEFAULT_CONNECTION_PRESET,
    capabilities: DEFAULT_CAPABILITIES,
    requestTransformer: openaiRequestTransformer,
    responseTransformer: openaiResponseTransformer,
    errorTransformer: openaiErrorTransformer
};

/**
 * 获取指定类型的 Provider 配置
 * @param {string} type - Provider 类型
 * @returns {Object} Provider 配置对象
 */
function getProvider(type) {
    const provider = providerRegistry.get(type);
    if (provider) return provider;
    const fallback = providerRegistry.get('openai-compatible');
    if (fallback) {
        console.warn(`Provider "${type}" not found, falling back to openai-compatible`);
        return fallback;
    }
    console.warn('No provider registered, using hardcoded default');
    return DEFAULT_PROVIDER;
}

/**
 * 获取所有已注册的 Provider 类型
 * @returns {string[]}
 */
function getAllProviderTypes() { return Array.from(providerRegistry.keys()); }

/**
 * 获取指定 Provider 的连接预设
 * @param {string} type - Provider 类型
 * @returns {Object}
 */
function getConnectionPreset(type) { return getProvider(type).connectionPreset; }

/**
 * 获取指定 Provider 的能力声明
 * @param {string} type - Provider 类型
 * @returns {Object}
 */
function getCapabilities(type) { return getProvider(type).capabilities; }

// ==========================================================================
// 响应转换器 (Response Transformers)
// ==========================================================================

/**
 * OpenAI 兼容格式的 SSE 响应转换
 * 从 SSE chunk 中提取 content、reasoning_content、tool_calls、finish_reason
 * @param {Object} sseChunk - SSE 数据块
 * @returns {Object|null} 标准化后的增量数据
 */
function openaiResponseTransformer(sseChunk) {
    if ('choices' in sseChunk && Array.isArray(sseChunk.choices) && sseChunk.choices.length > 0) {
        const choice = sseChunk.choices[0];
        const delta = choice.delta || choice.message;
        if (!delta) return null;
        return {
            content: typeof delta.content === 'string' ? delta.content : '',
            reasoning_content: typeof delta.reasoning_content === 'string' ? delta.reasoning_content : '',
            tool_calls: Array.isArray(delta.tool_calls) ? delta.tool_calls : [],
            finish_reason: choice.finish_reason || null,
        };
    }
    if ('response' in sseChunk) {
        const resp = sseChunk.response;
        if (!resp) return null;
        return {
            content: typeof resp.content === 'string' ? resp.content : '',
            reasoning_content: '',
            tool_calls: [],
            finish_reason: null
        };
    }
    return null;
}

// ==========================================================================
// 错误转换器 (Error Transformers)
// ==========================================================================

/**
 * OpenAI 兼容格式的错误信息提取
 * @param {Object} err - 错误响应对象
 * @returns {string} 人类可读的错误消息
 */
function openaiErrorTransformer(err) {
    if (err.error && typeof err.error === 'object' && typeof err.error.message === 'string') return err.error.message;
    if (Array.isArray(err.detail) && err.detail.length > 0) {
        const d = err.detail[0];
        if (typeof d.msg === 'string') return `${d.loc ? ' - ' + d.loc + ':' : ':'} ${d.msg}`;
    }
    return String(err.message || 'Unknown error');
}

/**
 * 中文 API 的错误信息提取（优先处理 detail 数组格式）
 * @param {Object} err - 错误响应对象
 * @returns {string} 人类可读的错误消息
 */
function chineseErrorTransformer(err) {
    if (Array.isArray(err.detail) && err.detail.length > 0) {
        const d = err.detail[0];
        if (typeof d.msg === 'string') return `${d.loc ? ' - ' + d.loc + ':' : ':'} ${d.msg}`;
    }
    if (err.error && typeof err.error === 'object' && typeof err.error.message === 'string') return err.error.message;
    return String(err.message || 'Unknown error');
}

// ==========================================================================
// 请求转换器 (Request Transformers)
// ==========================================================================

/**
 * OpenAI 兼容格式的请求转换（直接透传）
 * @param {Object} skeleton - 请求骨架
 * @returns {Object}
 */
function openaiRequestTransformer(skeleton) { return skeleton; }

// ==========================================================================
// Provider 注册
// ==========================================================================

// 注册 OpenAI Compatible
registerProvider({
    type: 'openai-compatible',
    connectionPreset: {
        defaultUrl: 'https://api.openai.com',
        defaultPath: '/v1/chat/completions',
        defaultModel: 'gpt-4o',
        authHeaderName: 'Authorization',
        authPrefix: 'Bearer '
    },
    capabilities: {
        streamSupported: true,
        toolCallSupported: true,
        reasoningSupported: true,
        seedSupported: false
    },
    requestTransformer: openaiRequestTransformer,
    responseTransformer: openaiResponseTransformer,
    errorTransformer: openaiErrorTransformer,
});

// 注册 Anthropic Compatible
registerProvider({
    type: 'anthropic-compatible',
    connectionPreset: {
        defaultUrl: 'https://api.anthropic.com',
        defaultPath: '/v1/messages',
        defaultModel: 'claude-3-5-sonnet-20241022',
        authHeaderName: 'x-api-key',
        authPrefix: ''
    },
    capabilities: {
        streamSupported: true,
        toolCallSupported: true,
        reasoningSupported: true,
        seedSupported: false
    },
    requestTransformer: (skeleton) => {
        const body = { ...skeleton };
        const messages = [...body.messages];
        const systemMessages = messages.filter(m => m.role === 'system');
        const otherMessages = messages.filter(m => m.role !== 'system');
        body.messages = otherMessages;
        if (systemMessages.length > 0) body.system = systemMessages.map(m => m.content).join('\n\n');
        if (!body.max_tokens) body.max_tokens = 8192;
        return body;
    },
    responseTransformer: (sseChunk) => {
        if (sseChunk.type === 'content_block_delta') {
            const delta = sseChunk.delta;
            if (!delta) return null;
            if (delta.type === 'text_delta') return { content: typeof delta.text === 'string' ? delta.text : '', reasoning_content: '', tool_calls: [], finish_reason: null };
            if (delta.type === 'thinking_delta') return { content: '', reasoning_content: typeof delta.thinking === 'string' ? delta.thinking : '', tool_calls: [], finish_reason: null };
            if (delta.type === 'input_json_delta') return { content: '', reasoning_content: '', tool_calls: [{ function: { arguments: typeof delta.partial_json === 'string' ? delta.partial_json : '' } }], finish_reason: null };
            return null;
        }
        if (sseChunk.type === 'content_block_start') {
            const cb = sseChunk.content_block;
            if (cb && cb.type === 'tool_use') return { content: '', reasoning_content: '', tool_calls: [{ id: cb.id, function: { name: cb.name } }], finish_reason: null };
            return null;
        }
        if (sseChunk.type === 'message_delta') return { content: '', reasoning_content: '', tool_calls: [], finish_reason: sseChunk.delta?.stop_reason || null };
        return null;
    },
    errorTransformer: (err) => {
        if (err.error && typeof err.error === 'object' && typeof err.error.message === 'string') return err.error.message;
        return String(err.message || 'Unknown error');
    },
});

// 注册 GLM
registerProvider({
    type: 'glm',
    connectionPreset: {
        defaultUrl: 'https://open.bigmodel.cn',
        defaultPath: '/api/paas/v4/chat/completions',
        defaultModel: 'glm-4',
        authHeaderName: 'Authorization',
        authPrefix: 'Bearer '
    },
    capabilities: {
        streamSupported: true,
        toolCallSupported: true,
        reasoningSupported: true,
        seedSupported: false
    },
    requestTransformer: (skeleton, config) => {
        const body = { ...skeleton };
        if (config.temperature && parseFloat(config.temperature) > 0) body.do_sample = true;
        return body;
    },
    responseTransformer: openaiResponseTransformer,
    errorTransformer: chineseErrorTransformer,
});

// 注册 Qwen
registerProvider({
    type: 'qwen',
    connectionPreset: {
        defaultUrl: 'https://dashscope.aliyuncs.com',
        defaultPath: '/compatible-mode/v1/chat/completions',
        defaultModel: 'qwen-plus',
        authHeaderName: 'Authorization',
        authPrefix: 'Bearer '
    },
    capabilities: {
        streamSupported: true,
        toolCallSupported: true,
        reasoningSupported: true,
        seedSupported: false
    },
    requestTransformer: openaiRequestTransformer,
    responseTransformer: openaiResponseTransformer,
    errorTransformer: chineseErrorTransformer,
});

// 注册 Kimi
registerProvider({
    type: 'kimi',
    connectionPreset: {
        defaultUrl: 'https://api.moonshot.cn',
        defaultPath: '/v1/chat/completions',
        defaultModel: 'moonshot-v1-8k',
        authHeaderName: 'Authorization',
        authPrefix: 'Bearer '
    },
    capabilities: {
        streamSupported: true,
        toolCallSupported: true,
        reasoningSupported: true,
        seedSupported: false
    },
    requestTransformer: (skeleton, config) => {
        const body = { ...skeleton };
        if (typeof config.reasoning_effort === 'string') body.reasoning_effort = config.reasoning_effort;
        return body;
    },
    responseTransformer: openaiResponseTransformer,
    errorTransformer: chineseErrorTransformer,
});

// 注册 MiniMax
registerProvider({
    type: 'minimax',
    connectionPreset: {
        defaultUrl: 'https://api.minimax.chat',
        defaultPath: '/v1/text/chatcompletion_v2',
        defaultModel: 'MiniMax-Text-01',
        authHeaderName: 'Authorization',
        authPrefix: 'Bearer '
    },
    capabilities: {
        streamSupported: true,
        toolCallSupported: true,
        reasoningSupported: false,
        seedSupported: false
    },
    requestTransformer: (skeleton, config) => {
        const body = { ...skeleton };
        if (config.mask_sensitive_info) body.mask_sensitive_info = true;
        return body;
    },
    responseTransformer: openaiResponseTransformer,
    errorTransformer: chineseErrorTransformer,
});

// 注册 Doubao-Seed
registerProvider({
    type: 'doubao-seed',
    connectionPreset: {
        defaultUrl: 'https://ark.cn-beijing.volces.com',
        defaultPath: '/api/v3/chat/completions',
        defaultModel: 'doubao-pro-32k',
        authHeaderName: 'Authorization',
        authPrefix: 'Bearer '
    },
    capabilities: {
        streamSupported: true,
        toolCallSupported: true,
        reasoningSupported: false,
        seedSupported: true
    },
    requestTransformer: (skeleton, config) => {
        const body = { ...skeleton };
        if (config.seed !== undefined && config.seed !== null) body.seed = config.seed;
        if (config.frequency_penalty !== undefined && config.frequency_penalty !== null) body.frequency_penalty = config.frequency_penalty;
        return body;
    },
    responseTransformer: openaiResponseTransformer,
    errorTransformer: chineseErrorTransformer,
});

// ==========================================================================
// 请求构建与适配 (Request Building & Adaptation)
// ==========================================================================

/**
 * 构建请求骨架
 * 根据 Provider 配置和消息列表生成标准化的请求体骨架
 * @param {Object} config - Provider 配置
 * @param {Array} messages - 消息列表
 * @returns {Object} 请求骨架
 */
function buildRequestSkeleton(config, messages) {
    const skeleton = { messages, model: config.model, stream: config.stream };
    if (config.max_tokens_value) skeleton[config.max_tokens_type] = parseInt(config.max_tokens_value);
    if (typeof config.reasoning_effort === 'string') {
        if (config.reasoning_effort === 'false') skeleton['chat_template_kwargs'] = { enable_thinking: false };
        else skeleton['reasoning_effort'] = config.reasoning_effort;
    }
    if (config.temperature) skeleton['temperature'] = parseFloat(config.temperature);
    if (config.top_p) skeleton['top_p'] = parseFloat(config.top_p);
    return skeleton;
}

/**
 * 构建认证请求头
 * @param {Object} config - Provider 配置
 * @returns {Object} HTTP 请求头对象
 */
function buildAuthHeaders(config) {
    const headers = { 'Content-Type': config.contentType || 'application/json' };
    const provider = getProvider(config.provider);
    const authHeaderName = config.authHeaderName || provider.connectionPreset.authHeaderName;
    const authPrefix = config.authPrefix !== undefined ? config.authPrefix : provider.connectionPreset.authPrefix;
    if (config.apiKey) headers[authHeaderName] = `${authPrefix}${config.apiKey}`;
    if (config.provider === 'anthropic-compatible') headers['anthropic-version'] = '2023-06-01';
    return headers;
}

/**
 * 适配请求 - 根据 Provider 类型转换请求体、构建请求头和 URL
 * @param {Object} config - Provider 配置
 * @param {Array} messages - 消息列表
 * @returns {{headers: Object, body: Object, url: string}}
 */
function adaptRequest(config, messages) {
    const provider = getProvider(config.provider);
    const skeleton = buildRequestSkeleton(config, messages);
    let body;
    try {
        body = provider.requestTransformer(skeleton, config);
    } catch (e) {
        console.warn(`Request transformer for "${config.provider}" failed, falling back to openai-compatible:`, e);
        body = getProvider('openai-compatible').requestTransformer(skeleton, config);
    }
    const headers = buildAuthHeaders(config);
    const url = config.url + (config.path ? config.path : '');
    return { headers, body, url };
}

/**
 * 标准化 SSE 数据块
 * @param {string} providerType - Provider 类型
 * @param {Object} rawChunk - 原始 SSE 数据块
 * @returns {Object|null} 标准化后的增量数据
 */
function normalizeSSEChunk(providerType, rawChunk) {
    try { return getProvider(providerType).responseTransformer(rawChunk); }
    catch (e) { console.warn(`Response transformer for "${providerType}" failed:`, e); return null; }
}

/**
 * 标准化错误信息
 * @param {string} providerType - Provider 类型
 * @param {Object} errorResponse - 错误响应对象
 * @param {string} apiKey - API Key（用于脱敏）
 * @returns {string} 人类可读的错误消息
 */
function normalizeError(providerType, errorResponse, apiKey) {
    let message;
    try { message = getProvider(providerType).errorTransformer(errorResponse); }
    catch (e) { message = String(errorResponse?.message || 'Unknown error'); }
    if (apiKey && message.includes(apiKey)) {
        message = message.replace(new RegExp(apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***REDACTED***');
    }
    return message;
}

/**
 * 迁移所有旧配置 - 为缺少 provider 字段的配置添加默认值
 */
function migrateAllConfigs() {
    try {
        for (const key of Object.keys(localStorage)) {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object' && parsed.apiKey !== undefined && parsed.url !== undefined && !parsed.provider) {
                    parsed.provider = 'openai-compatible';
                    localStorage.setItem(key, JSON.stringify(parsed));
                }
            } catch (e) { console.warn(`Failed to migrate config for key "${key}":`, e); }
        }
    } catch (e) { console.warn('localStorage not available, migration skipped:', e); }
}

// 加载时执行迁移
migrateAllConfigs();

// ==========================================================================
// 多 Provider 实例管理 (Multi-Provider Instance Management)
// ==========================================================================

/**
 * Provider 显示名称映射
 * @type {Object<string, string>}
 */
const PROVIDER_DISPLAY_NAMES = {
    'openai-compatible': 'OpenAI',
    'anthropic-compatible': 'Anthropic',
    'glm': 'GLM',
    'qwen': 'Qwen',
    'kimi': 'Kimi',
    'minimax': 'MiniMax',
    'doubao-seed': 'Doubao',
};

/**
 * 生成唯一的实例 ID
 * @returns {string} UUID 或基于时间戳的 ID
 */
function generateInstanceId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'pi-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10);
}

/**
 * 生成默认实例名称
 * @param {string} providerType - Provider 类型
 * @param {number} existingCount - 已有实例数量
 * @returns {string}
 */
function generateDefaultName(providerType, existingCount) {
    const displayName = PROVIDER_DISPLAY_NAMES[providerType] || providerType;
    return `${displayName}-${existingCount + 1}`;
}

/**
 * 脱敏 API Key
 * @param {string} apiKey - 原始 API Key
 * @returns {string} 脱敏后的字符串
 */
function maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 8) return '****';
    return apiKey.substring(0, 4) + '****' + apiKey.substring(apiKey.length - 4);
}

/**
 * 创建默认 Provider 实例
 * @param {string} providerType - Provider 类型
 * @returns {Object} 默认实例配置
 */
function createDefaultInstance(providerType) {
    const preset = getConnectionPreset(providerType);
    return {
        id: generateInstanceId(),
        name: generateDefaultName(providerType, 0),
        provider: providerType,
        apiKey: '',
        url: preset.defaultUrl,
        path: preset.defaultPath,
        model: preset.defaultModel,
        authHeaderName: preset.authHeaderName,
        authPrefix: preset.authPrefix,
        contentType: 'application/json',
        max_tokens_type: 'max_tokens',
        max_tokens_value: '',
        temperature: '',
        top_p: '',
        method: 'POST',
        stream: true,
        thinking: true,
        reasoning_effort: null,
        mcp: true,
        seed: null,
        frequency_penalty: null,
        mask_sensitive_info: false,
    };
}

/**
 * 验证 Provider 实例的有效性
 * @param {Object} instance - 实例对象
 * @returns {boolean}
 */
function validateInstance(instance) {
    if (!instance || typeof instance !== 'object') return false;
    if (typeof instance.id !== 'string' || !instance.id) return false;
    if (typeof instance.name !== 'string') return false;
    if (typeof instance.provider !== 'string' || !instance.provider) return false;
    return true;
}

/**
 * 需要从实例同步到 Store 的字段列表
 * @type {string[]}
 */
const INSTANCE_FIELDS = [
    'provider', 'apiKey', 'url', 'path', 'model', 'authPrefix', 'authHeaderName',
    'contentType', 'max_tokens_type', 'max_tokens_value', 'temperature', 'top_p',
    'method', 'stream', 'thinking', 'reasoning_effort', 'mcp',
    'seed', 'frequency_penalty', 'mask_sensitive_info'
];

/**
 * 将 Provider 实例的字段应用到 Store
 * @param {Object} store - Pinia Store 实例
 * @param {Object} instance - Provider 实例
 */
function applyInstanceToStore(store, instance) {
    for (const field of INSTANCE_FIELDS) {
        if (instance[field] !== undefined) {
            store[field] = instance[field];
        }
    }
}

/**
 * 执行 V2 数据迁移 - 将旧格式的单个 Provider 配置迁移到多实例格式
 */
function runMigrationV2() {
    try {
        const storeKey = 'chatbotStore';
        const raw = localStorage.getItem(storeKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;

        // 如果已有有效的 providers 数组，只需验证
        if (Array.isArray(parsed.providers) && parsed.providers.length > 0) {
            const validProviders = parsed.providers.filter(validateInstance);
            if (validProviders.length > 0) {
                parsed.providers = validProviders;
                if (!validProviders.find(p => p.id === parsed.activeProviderId)) {
                    parsed.activeProviderId = validProviders[0].id;
                }
                localStorage.setItem(storeKey, JSON.stringify(parsed));
                return;
            }
        }

        // 从旧格式创建新实例
        const instance = {
            id: generateInstanceId(),
            name: generateDefaultName(parsed.provider || 'openai-compatible', 0),
            provider: parsed.provider || 'openai-compatible',
            apiKey: parsed.apiKey || '',
            url: parsed.url || '',
            path: parsed.path || '',
            model: parsed.model || '',
            authPrefix: parsed.authPrefix !== undefined ? parsed.authPrefix : 'Bearer',
            authHeaderName: parsed.authHeaderName || 'Authorization',
            contentType: parsed.contentType || 'application/json',
            max_tokens_type: parsed.max_tokens_type || 'max_tokens',
            max_tokens_value: parsed.max_tokens_value || '',
            temperature: parsed.temperature || '',
            top_p: parsed.top_p || '',
            method: parsed.method || 'POST',
            stream: parsed.stream !== undefined ? parsed.stream : true,
            thinking: parsed.thinking !== undefined ? parsed.thinking : true,
            reasoning_effort: parsed.reasoning_effort !== undefined ? parsed.reasoning_effort : null,
            mcp: parsed.mcp !== undefined ? parsed.mcp : true,
            seed: parsed.seed !== undefined ? parsed.seed : null,
            frequency_penalty: parsed.frequency_penalty !== undefined ? parsed.frequency_penalty : null,
            mask_sensitive_info: parsed.mask_sensitive_info !== undefined ? parsed.mask_sensitive_info : false,
        };

        parsed.providers = [instance];
        parsed.activeProviderId = instance.id;
        localStorage.setItem(storeKey, JSON.stringify(parsed));
    } catch (e) {
        console.warn('Migration V2 failed:', e);
    }
}

/**
 * 确保 Store 中有有效的 Provider 实例
 * 如果 providers 数组为空或无效，创建默认实例
 * @param {Object} store - chatbotStore 实例
 */
function ensureProviderInstances(store) {
    if (!Array.isArray(store.providers) || store.providers.length === 0) {
        console.warn('providers was invalid or empty, created default instance');
        const instance = createDefaultInstance('openai-compatible');
        store.providers = [instance];
        store.activeProviderId = instance.id;
        applyInstanceToStore(store, instance);
    } else {
        store.providers = store.providers.filter(validateInstance);
        if (store.providers.length === 0) {
            console.warn('All provider instances invalid, created default instance');
            const instance = createDefaultInstance('openai-compatible');
            store.providers = [instance];
            store.activeProviderId = instance.id;
            applyInstanceToStore(store, instance);
        } else if (!store.providers.find(p => p.id === store.activeProviderId)) {
            console.warn('activeProviderId not found in providers, reset to first');
            store.activeProviderId = store.providers[0].id;
            applyInstanceToStore(store, store.providers[0]);
        } else if (!PROVIDER_TYPES.includes(store.provider)) {
            console.warn(`store.provider "${store.provider}" is not a valid ProviderType, synced from activeProvider`);
            const active = store.providers.find(p => p.id === store.activeProviderId);
            applyInstanceToStore(store, active || store.providers[0]);
        }
    }
}
