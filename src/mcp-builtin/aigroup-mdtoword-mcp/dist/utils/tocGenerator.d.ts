import { TableOfContentsConfig } from '../types/style.js';
import { Paragraph, TableOfContents } from 'docx';
/**
 * 目录生成器类
 * 负责生成和管理文档目录
 */
export declare class TOCGenerator {
    private headings;
    /**
     * 添加标题条目
     */
    addHeading(level: number, text: string, pageNumber?: number): void;
    /**
     * 清空标题列表
     */
    clear(): void;
    /**
     * 创建目录段落
     */
    static createTOC(config: TableOfContentsConfig): TableOfContents;
    /**
     * 创建目录标题段落
     */
    static createTOCTitle(config: TableOfContentsConfig): Paragraph;
    /**
     * 验证目录配置
     */
    static validateTOCConfig(config: TableOfContentsConfig): {
        valid: boolean;
        errors: string[];
    };
    /**
     * 获取默认目录配置
     */
    static getDefaultConfig(): TableOfContentsConfig;
    /**
     * 合并目录配置
     */
    static mergeConfig(base: TableOfContentsConfig, override: Partial<TableOfContentsConfig>): TableOfContentsConfig;
    /**
     * 从文档内容中提取标题
     */
    extractHeadings(content: string): Array<{
        level: number;
        text: string;
    }>;
}
//# sourceMappingURL=tocGenerator.d.ts.map