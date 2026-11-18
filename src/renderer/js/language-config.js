/**
 * ==========================================================================
 * language-config - 语言映射与导航级别集中配置
 * ==========================================================================
 * LANGUAGE_MAPPING_TABLE: 扩展名 → Monaco 语言标识映射（30+ 种语言）
 * LANGUAGE_NAVIGATION_CONFIG: 语言 → 导航级别（highlight / highlight+outline）
 */

const LANGUAGE_MAPPING_TABLE = {
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'javascript',
    'tsx': 'typescript',
    'json': 'json',
    'md': 'markdown',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'py': 'python',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'txt': 'plaintext',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'c': 'c',
    'h': 'c',
    'cpp': 'cpp',
    'hpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'kt': 'kotlin',
    'kts': 'kotlin',
    'swift': 'swift',
    'scala': 'scala',
    'sql': 'sql',
    'dockerfile': 'dockerfile',
    'toml': 'toml',
    'ini': 'ini',
    'bat': 'bat',
    'ps1': 'powershell',
    'lua': 'lua',
    'r': 'r',
    'dart': 'dart',
    'vue': 'html',
    'svelte': 'html',
    'graphql': 'graphql',
    'gql': 'graphql',
    'proto': 'proto',
    'plaintext': 'plaintext',
    'log': 'plaintext',
    'conf': 'ini',
    'cfg': 'ini',
    'env': 'plaintext',
};

const LANGUAGE_NAVIGATION_CONFIG = {
    highlight: [
        'scss', 'less', 'shell', 'dockerfile', 'toml', 'ini',
        'bat', 'powershell', 'plaintext', 'html',
    ],
    highlight_hover: [
        'python', 'java', 'csharp', 'go', 'rust', 'cpp', 'c',
        'php', 'ruby', 'kotlin', 'swift', 'scala', 'json',
        'yaml', 'xml', 'markdown', 'sql', 'lua', 'r', 'dart',
        'graphql', 'proto',
    ],
    highlight_hover_definition: [
        'typescript', 'javascript',
    ],
};

function getLanguageByExtension(filePath) {
    if (!filePath) return 'plaintext';
    const parts = filePath.split('.');
    if (parts.length === 1) {
        const baseName = parts[0].toLowerCase();
        if (baseName === 'dockerfile') return 'dockerfile';
        return 'plaintext';
    }
    const ext = parts.pop().toLowerCase();
    return LANGUAGE_MAPPING_TABLE[ext] || 'plaintext';
}

function getNavigationLevel(language) {
    if (LANGUAGE_NAVIGATION_CONFIG.highlight_hover_definition.includes(language)) {
        return 'highlight_hover_definition';
    }
    if (LANGUAGE_NAVIGATION_CONFIG.highlight_hover.includes(language)) {
        return 'highlight_hover';
    }
    return 'highlight';
}

const LSP_ENHANCED = 'lsp_enhanced';

if (typeof window !== 'undefined') {
    window.LANGUAGE_MAPPING_TABLE = LANGUAGE_MAPPING_TABLE;
    window.LANGUAGE_NAVIGATION_CONFIG = LANGUAGE_NAVIGATION_CONFIG;
    window.getLanguageByExtension = getLanguageByExtension;
    window.getNavigationLevel = getNavigationLevel;
    window.LSP_ENHANCED = LSP_ENHANCED;
}