import { StyleConfig } from '../types/style.js';
import { LegacyStyleConfig } from '../types/template.js';
/**
 * 样式转换工具类
 * 用于在新旧样式系统之间进行转换
 */
export declare class StyleConverter {
    /**
     * 将旧版样式配置转换为新版样式配置
     */
    static convertLegacyToNew(legacyConfig: LegacyStyleConfig): StyleConfig;
    /**
     * 将新版样式配置转换为旧版样式配置
     */
    static convertNewToLegacy(newConfig: StyleConfig): LegacyStyleConfig;
    /**
     * 验证样式配置是否为旧版格式
     */
    static isLegacyConfig(config: any): config is LegacyStyleConfig;
    /**
     * 自动检测并转换样式配置
     */
    static autoConvert(config: any): StyleConfig;
}
/**
 * 样式配置验证器
 */
export declare class StyleValidator {
    /**
     * 验证颜色格式
     */
    static isValidColor(color: string): boolean;
    /**
     * 验证字体大小
     */
    static isValidFontSize(size: number): boolean;
    /**
     * 验证样式配置
     */
    static validateStyleConfig(config: StyleConfig): {
        valid: boolean;
        errors: string[];
    };
}
//# sourceMappingURL=styleConverter.d.ts.map