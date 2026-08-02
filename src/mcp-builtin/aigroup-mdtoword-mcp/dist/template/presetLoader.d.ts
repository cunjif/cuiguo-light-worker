import { StyleConfig } from '../types/style.js';
/**
 * 预设模板接口
 */
export interface PresetTemplate {
    name: string;
    description: string;
    category: string;
    styleConfig: StyleConfig;
}
/**
 * 优化的预设模板加载器 - 无文件系统操作，适用于无服务器环境
 */
export declare class PresetTemplateLoader {
    private templates;
    private defaultTemplateId;
    constructor();
    /**
     * 从静态配置加载模板 - 零文件系统操作
     */
    private loadStaticTemplates;
    /**
     * 获取所有预设模板
     */
    getPresetTemplates(): Map<string, PresetTemplate>;
    /**
     * 根据ID获取预设模板
     */
    getPresetTemplate(id: string): PresetTemplate | undefined;
    /**
     * 获取默认模板
     */
    getDefaultTemplate(): PresetTemplate | undefined;
    /**
     * 获取默认模板的样式配置
     */
    getDefaultStyleConfig(): StyleConfig | undefined;
    /**
     * 获取默认模板ID
     */
    getDefaultTemplateId(): string;
    /**
     * 检查模板是否存在
     */
    hasTemplate(id: string): boolean;
    /**
     * 获取模板列表（用于API返回）
     */
    getTemplateList(): Array<{
        id: string;
        name: string;
        description: string;
        category: string;
        isDefault: boolean;
    }>;
    /**
     * 重新加载模板（静态模式下实际上是重新初始化）
     */
    reload(): void;
}
/**
 * 全局预设模板加载器实例
 */
export declare const presetTemplateLoader: PresetTemplateLoader;
//# sourceMappingURL=presetLoader.d.ts.map