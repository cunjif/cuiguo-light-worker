import { MarkdownConverter } from '../types/index.js';
import { StyleConfig } from '../types/style.js';
export declare class DocxMarkdownConverter implements MarkdownConverter {
    private md;
    private effectiveStyleConfig;
    private errorHandler;
    private tocGenerator;
    private mathProcessor;
    private baseDir?;
    constructor(styleConfig?: StyleConfig, baseDir?: string);
    convert(markdown: string): Promise<Buffer>;
    private createDocument;
    /**
     * 创建页眉（从配置对象）
     */
    private createHeaderFromConfig;
    /**
     * 创建页脚（从配置对象）
     */
    private createFooterFromConfig;
    /**
     * 创建 DOCX 标题样式
     */
    private createDocxHeadingStyle;
    /**
     * 获取页面大小
     */
    private getPageSize;
    /**
     * 获取页面方向
     */
    private getPageOrientation;
    /**
     * 获取页码格式
     */
    private getPageNumberFormat;
    /**
     * 获取页边距
     */
    private getPageMargins;
    private processTokens;
    private processInlineContentAsync;
    /**
     * 获取文本样式
     */
    private getTextStyle;
    /**
     * 合并文本样式
     */
    private mergeTextStyles;
    /**
     * 将文本样式转换为 DOCX 格式
     */
    private convertTextStyleToDocx;
    private createHeading;
    private createParagraph;
    private createListItem;
    private createBlockquote;
    private createCodeBlock;
    /**
     * 创建表格 - 支持新的表格样式和配置
     * 保持向后兼容旧的TextRun[][][]格式
     */
    private createTable;
    /**
     * 从TableData创建表格（新方法）
     */
    private createTableFromData;
    /**
     * 创建表格（旧方法，保持兼容）
     */
    private createTableLegacy;
    private createParagraphWithImages;
    private createImageRun;
    private createImageParagraph;
    /**
     * 创建占位符图片
     */
    private createPlaceholderImageRun;
    private extractTableData;
}
//# sourceMappingURL=markdown.d.ts.map