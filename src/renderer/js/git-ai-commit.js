/**
 * ==========================================================================
 * Git AI Commit Message Generator - AI 提交消息生成
 * ==========================================================================
 * 基于已暂存 diff 内容，通过 AI 模型流式生成符合规范的提交消息
 * 依赖：adaptRequest、normalizeSSEChunk（providers.js 全局）、useChatbotStore
 */

/**
 * 选择用于生成提交消息的 Provider 实例
 * 策略：优先 modelRole === 'commit'，降级到 getPrimaryProvider()，再降级到 chatbotStore 顶层字段
 */
function selectCommitProvider(chatbotStore) {
    const commitInstance = chatbotStore.getProviderByRole?.('commit');
    if (commitInstance && commitInstance.apiKey) {
        return commitInstance;
    }
    const primaryInstance = chatbotStore.getPrimaryProvider;
    if (primaryInstance) {
        const primary = typeof primaryInstance === 'function' ? primaryInstance.call(chatbotStore) : primaryInstance;
        if (primary && primary.apiKey) {
            return primary;
        }
    }
    // 降级到 chatbotStore 顶层字段（兼容旧配置）
    return chatbotStore;
}

/**
 * 构造提交消息生成的消息列表
 */
function buildCommitMessages(diff) {
    const systemPrompt = [
        'You are a helpful assistant that generates concise, conventional commit messages.',
        'Follow the Conventional Commits specification: <type>(<scope>): <description>.',
        'Type must be one of: feat, fix, docs, style, refactor, perf, test, chore, build, ci, revert.',
        'Keep the subject line under 72 characters. Use imperative mood.',
        'If needed, add a blank line followed by a body explaining what and why (not how).',
        'Output ONLY the commit message, no code fences, no explanations, no preamble.',
    ].join(' ');

    // diff 可能过长，截断保护
    const maxDiffChars = 8000;
    const truncatedDiff = diff.length > maxDiffChars
        ? diff.substring(0, maxDiffChars) + '\n... [diff truncated]'
        : diff;

    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a commit message for the following staged diff:\n\n${truncatedDiff}` },
    ];
}

/**
 * 流式生成提交消息
 * @param {string} diff - 已暂存 diff 内容
 * @param {Object} chatbotStore - chatbotStore 实例
 * @param {AbortSignal} [signal] - 中止信号
 * @returns {AsyncGenerator<{content: string}>}
 */
async function* generateCommitMessage(diff, chatbotStore, signal) {
    const instance = selectCommitProvider(chatbotStore);
    const messages = buildCommitMessages(diff);

    // 构造请求
    const { headers: authHeaders, body: requestBody, url } = adaptRequest(instance, messages);

    // 强制流式输出
    const body = { ...requestBody, stream: true };

    const request = {
        headers: authHeaders,
        method: instance.method || 'POST',
        body: JSON.stringify(body),
        ...(signal ? { signal } : {}),
    };

    const response = await fetch(url, request);
    if (!response.ok) {
        let errorData;
        try { errorData = await response.json(); } catch { errorData = {}; }
        const errorMsg = normalizeError(instance.provider, errorData, instance.apiKey);
        throw new Error(`${response.status}: ${errorMsg}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    const providerType = instance.provider;

    try {
        while (true) {
            if (signal?.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }
            const { done, value } = await reader.read();
            if (done) break;

            const chunks = decoder.decode(value, { stream: true });
            const lines = (buffer + chunks).split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                const pos = trimmed.indexOf(':');
                const name = trimmed.substring(0, pos);
                if (name !== 'data') continue;
                const content = trimmed.substring(pos + 1).trim();
                if (!content || content === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(content);
                    const delta = normalizeSSEChunk(providerType, parsed);
                    if (delta?.content) {
                        yield { content: delta.content };
                    }
                } catch (e) {
                    // 忽略解析错误，继续下一行
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}