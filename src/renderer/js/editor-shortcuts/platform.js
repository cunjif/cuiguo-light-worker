/**
 * ==========================================================================
 * platform - 平台判定与修饰键映射
 * ==========================================================================
 * 提供 macOS/Win/Linux 平台判定与修饰键属性名映射，供命中判定器按平台读取
 * KeyboardEvent 上的对应修饰键属性（macOS→metaKey，其他→ctrlKey）。
 */

function isMacPlatform() {
    try {
        const platform = (typeof navigator !== 'undefined' && navigator.platform) || '';
        const userAgent = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
        return /Mac|iPod|iPhone|iPad/.test(platform || userAgent);
    } catch (e) {
        return false;
    }
}

function modifierKeyName() {
    return isMacPlatform() ? 'metaKey' : 'ctrlKey';
}

if (typeof window !== 'undefined') {
    window.EditorShortcutsPlatform = { isMacPlatform, modifierKeyName };
}