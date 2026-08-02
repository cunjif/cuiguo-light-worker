import { ErrorDetail, StyleValidationResult } from '../types/style.js';
/**
 * 错误处理器类
 * 提供统一的错误处理和验证机制
 */
export declare class ErrorHandler {
    private errors;
    private warnings;
    /**
     * 添加错误
     */
    addError(code: string, message: string, location?: ErrorDetail['location'], suggestion?: string): void;
    /**
     * 添加警告
     */
    addWarning(code: string, message: string, location?: ErrorDetail['location'], suggestion?: string): void;
    /**
     * 获取所有错误
     */
    getErrors(): ErrorDetail[];
    /**
     * 获取所有警告
     */
    getWarnings(): ErrorDetail[];
    /**
     * 是否有错误
     */
    hasErrors(): boolean;
    /**
     * 是否有警告
     */
    hasWarnings(): boolean;
    /**
     * 清空所有错误和警告
     */
    clear(): void;
    /**
     * 获取验证结果
     */
    getValidationResult(): StyleValidationResult;
    /**
     * 格式化错误信息
     */
    formatError(error: ErrorDetail): string;
    /**
     * 打印所有错误和警告
     */
    printAll(): void;
    /**
     * 尝试自动修复错误
     */
    static autoFix(config: any): {
        fixed: any;
        changes: string[];
    };
}
/**
 * 配置验证器类
 */
export declare class ConfigValidator {
    private errorHandler;
    constructor();
    /**
     * 验证颜色值
     */
    validateColor(color: string | undefined, fieldName: string): boolean;
    /**
     * 验证字号
     */
    validateSize(size: number | undefined, fieldName: string, min?: number, max?: number): boolean;
    /**
     * 验证透明度
     */
    validateOpacity(opacity: number | undefined, fieldName: string): boolean;
    /**
     * 获取验证结果
     */
    getResult(): StyleValidationResult;
    /**
     * 重置验证器
     */
    reset(): void;
    /**
     * 打印验证结果
     */
    print(): void;
}
//# sourceMappingURL=errorHandler.d.ts.map