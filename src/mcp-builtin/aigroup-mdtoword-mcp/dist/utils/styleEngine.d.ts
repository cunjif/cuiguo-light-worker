import { StyleConfig, StyleValidationResult, StyleContext, StyleMergeOptions } from '../types/style.js';
/**
 * 样式引擎类 - 负责样式验证、合并和应用
 */
export declare class StyleEngine {
    private defaultConfig;
    private styleCache;
    private themesCache;
    private cacheHits;
    private cacheMisses;
    constructor();
    /**
     * 获取缓存统计信息
     */
    getCacheStats(): {
        hits: number;
        misses: number;
        size: number;
        hitRate: string;
    };
    /**
     * 创建默认样式配置
     */
    private createDefaultStyleConfig;
    /**
     * 验证样式配置（增强版）
     */
    validateStyleConfig(config: StyleConfig): StyleValidationResult;
    /**
     * 验证主题配置
     */
    private validateTheme;
    /**
     * 合并样式配置
     */
    mergeStyleConfigs(base: StyleConfig, override: StyleConfig, options?: StyleMergeOptions): StyleConfig;
    /**
     * 深度合并对象
     */
    private deepMerge;
    /**
     * 获取合并后的样式配置（优化缓存）
     */
    getEffectiveStyleConfig(userConfig?: StyleConfig): StyleConfig;
    /**
     * 生成缓存键
     */
    private generateCacheKey;
    /**
     * 应用主题到样式配置
     */
    private applyTheme;
    /**
     * 应用主题颜色
     */
    private applyThemeColors;
    /**
     * 清理无效的样式值
     */
    private cleanInvalidValues;
    /**
     * 根据上下文获取样式
     */
    getStyleForContext(context: StyleContext, config: StyleConfig): any;
    /**
     * 清除样式缓存
     */
    clearCache(): void;
    /**
     * 清除特定缓存
     */
    clearCacheFor(config: StyleConfig): void;
    /**
     * 获取默认样式配置
     */
    getDefaultConfig(): StyleConfig;
}
/**
 * 全局样式引擎实例
 */
export declare const styleEngine: StyleEngine;
//# sourceMappingURL=styleEngine.d.ts.map