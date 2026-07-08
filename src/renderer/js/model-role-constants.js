const MODEL_ROLES = {
    PRIMARY: 'primary',
    EDIT: 'edit',
    ADVISOR: 'advisor',
    EMBEDDINGS: 'embeddings',
    VISION: 'vision',
    STT: 'stt',
    UNASSIGNED: 'unassigned',
};

const ROLE_GROUPS = [
    { label: '核心角色', roles: ['primary'] },
    { label: '编辑与顾问', roles: ['edit', 'advisor'] },
    { label: '搜索增强', roles: ['embeddings'] },
    { label: '多模态', roles: ['vision', 'stt'] },
    { label: '其他', roles: ['unassigned'] },
];

const ROLE_DISPLAY_NAMES = {
    primary: '主模型',
    edit: '编辑',
    advisor: '顾问模型',
    embeddings: '向量嵌入',
    vision: '图片识别',
    stt: '语音转文字',
    unassigned: '未分配',
};

const ROLE_COLORS = {
    primary: 'primary',
    edit: 'teal',
    advisor: 'purple',
    embeddings: 'cyan',
    vision: 'orange',
    stt: 'pink',
    unassigned: 'grey',
};

const ROLE_ICONS = {
    primary: 'mdi-star',
    edit: 'mdi-pencil',
    advisor: 'mdi-account-search',
    embeddings: 'mdi-vector-combine',
    vision: 'mdi-eye',
    stt: 'mdi-microphone',
    unassigned: 'mdi-help-circle-outline',
};

const ROLE_DESCRIPTIONS = {
    primary: '负责主对话流程',
    edit: '处理编辑指令',
    advisor: '提供第二意见与审查',
    embeddings: '生成向量嵌入',
    vision: '识别与理解图片内容',
    stt: '将语音转写为文字',
    unassigned: '尚未分配角色',
};

function buildRoleSelectItems() {
    const items = [];
    for (const group of ROLE_GROUPS) {

        for (const role of group.roles) {
            items.push({ value: role, title: ROLE_DISPLAY_NAMES[role] || role });
        }
    }
    return items;
}

function getRoleDisplayName(role) {
    if (!role) return '未知角色';
    return ROLE_DISPLAY_NAMES[role] || `未知角色：${role}`;
}

function getRoleColor(role) {
    if (!role) return 'grey';
    return ROLE_COLORS[role] || 'grey';
}

function getRoleIcon(role) {
    if (!role) return 'mdi-help-circle-outline';
    return ROLE_ICONS[role] || 'mdi-help-circle-outline';
}

function getRoleDescription(role) {
    if (!role) return '';
    return ROLE_DESCRIPTIONS[role] || '';
}

function isValidModelRole(role) {
    return role && Object.values(MODEL_ROLES).includes(role);
}