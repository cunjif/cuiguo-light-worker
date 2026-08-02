import { ImageStyle } from '../types/style.js';
/**
 * 图片处理器类
 * 负责图片的加载、格式识别、尺寸计算等
 */
export declare class ImageProcessor {
    private static readonly DEFAULT_MAX_WIDTH;
    private static readonly DEFAULT_MAX_HEIGHT;
    private static readonly DEFAULT_ASPECT_RATIO;
    /**
     * 支持的图片格式
     */
    private static readonly SUPPORTED_FORMATS;
    /**
     * 加载图片数据
     * @param src 图片路径
     * @param baseDir Markdown文件所在目录，用于解析相对路径
     */
    static loadImageData(src: string, baseDir?: string): Promise<{
        data: Buffer | string;
        type: string | null;
        error?: string;
    }>;
    /**
     * 从Data URL识别图片类型
     */
    private static getImageTypeFromDataUrl;
    /**
     * 从URL识别图片类型
     */
    private static getImageTypeFromUrl;
    /**
     * 计算图片尺寸
     * 考虑最大尺寸限制和宽高比保持
     */
    static calculateDimensions(originalWidth?: number, originalHeight?: number, imageStyle?: ImageStyle): {
        width: number;
        height: number;
    };
    /**
     * 验证图片格式是否支持
     */
    static isSupportedFormat(type: string | null, allowedFormats?: string[]): boolean;
    /**
     * 创建占位符SVG
     */
    static createPlaceholderSvg(width: number, height: number, errorMessage: string, alt: string, src: string): Buffer;
    /**
     * 转换毫米到缇
     */
    static convertMillimetersToTwip(mm: number): number;
    /**
     * 转换缇到毫米
     */
    static convertTwipToMillimeters(twip: number): number;
}
//# sourceMappingURL=imageProcessor.d.ts.map