import { WatermarkConfig } from '../types/style.js';
/**
 * 水印处理器类
 * 负责创建和配置文档水印
 */
export declare class WatermarkProcessor {
    /**
     * 创建水印配置
     */
    static createWatermark(config: WatermarkConfig): any;
    /**
     * 验证水印配置
     */
    static validateWatermarkConfig(config: WatermarkConfig): {
        valid: boolean;
        errors: string[];
    };
    /**
     * 获取默认水印配置
     */
    static getDefaultConfig(): WatermarkConfig;
    /**
     * 合并水印配置
     */
    static mergeConfig(base: WatermarkConfig, override: Partial<WatermarkConfig>): WatermarkConfig;
}
//# sourceMappingURL=watermarkProcessor.d.ts.map