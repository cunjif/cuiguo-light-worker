function detectRequiredRoles(attachments, scenario) {
    const roles = [];

    if (Array.isArray(attachments)) {
        for (const att of attachments) {
            if (att.type && att.type.startsWith('image/')) {
                if (!roles.find(r => r.role === 'vision')) {
                    roles.push({ role: 'vision', reason: '消息包含图片附件' });
                }
            }
            if (att.type && att.type.startsWith('audio/')) {
                if (!roles.find(r => r.role === 'stt')) {
                    roles.push({ role: 'stt', reason: '消息包含音频附件' });
                }
            }
        }
    }

    if (scenario === 'edit' && !roles.find(r => r.role === 'edit')) {
        roles.push({ role: 'edit', reason: '编辑场景' });
    }
    if (scenario === 'advisor' && !roles.find(r => r.role === 'advisor')) {
        roles.push({ role: 'advisor', reason: '顾问审查场景' });
    }
    if (scenario === 'search' && !roles.find(r => r.role === 'embeddings')) {
        roles.push({ role: 'embeddings', reason: '搜索增强场景' });
    }

    return roles;
}

function resolveAuxiliaryModel(role) {
    const chatbotStore = useChatbotStore();
    return chatbotStore.getProviderByRole(role);
}

async function executeAuxiliaryRequest(instance, messages) {
    if (!instance.apiKey) {
        return {
            success: false,
            content: '',
            error: `辅助模型 [${instance.name}] 未配置 API Key，已跳过`,
            instanceName: instance.name,
        };
    }

    try {
        const chatbotStore = useChatbotStore();
        const tempStore = { ...chatbotStore.$state };
        for (const field of INSTANCE_FIELDS) {
            if (instance[field] !== undefined) {
                chatbotStore[field] = instance[field];
            }
        }

        const body = adaptRequest(chatbotStore, messages);

        for (const field of INSTANCE_FIELDS) {
            if (tempStore[field] !== undefined) {
                chatbotStore[field] = tempStore[field];
            }
        }

        delete body.tools;
        delete body.tool_choice;

        const headers = {
            'Content-Type': instance.contentType || 'application/json',
        };
        const authHeader = instance.authHeaderName || 'Authorization';
        const authPrefix = instance.authPrefix || 'Bearer';
        headers[authHeader] = `${authPrefix} ${instance.apiKey}`;
        if (instance.userId && instance.userId.trim() !== '') headers['userId'] = instance.userId;

        const url = (instance.url || '') + (instance.path || '');
        const response = await fetch(url, {
            method: instance.method || 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            return {
                success: false,
                content: '',
                error: `辅助模型调用失败：HTTP ${response.status} ${errorText}`.substring(0, 200),
                instanceName: instance.name,
            };
        }

        const data = await response.json();
        let content = '';

        if (data.choices && data.choices[0]) {
            const choice = data.choices[0];
            if (choice.message) {
                content = choice.message.content || '';
            }
        }

        return {
            success: true,
            content,
            instanceName: instance.name,
        };
    } catch (e) {
        return {
            success: false,
            content: '',
            error: `辅助模型调用失败：${e.message || e}`.substring(0, 200),
            instanceName: instance.name,
        };
    }
}

async function dispatchAuxiliaryModels(attachments, scenario) {
    const requiredRoles = detectRequiredRoles(attachments, scenario);
    const results = [];

    for (const { role, reason } of requiredRoles) {
        const instance = resolveAuxiliaryModel(role);
        if (!instance) continue;

        const messages = [{ role: 'user', content: reason }];
        const result = await executeAuxiliaryRequest(instance, messages);
        results.push({ role, ...result });
    }

    return results;
}