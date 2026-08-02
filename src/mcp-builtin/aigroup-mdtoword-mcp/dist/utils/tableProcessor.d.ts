import { TableStyle, TableData, TableCellConfig } from '../types/style.js';
/**
 * 预定义的表格样式库
 */
export declare const TABLE_STYLE_PRESETS: Record<string, TableStyle>;
/**
 * 表格处理器类
 */
export declare class TableProcessor {
    /**
     * 从CSV数据创建表格
     * @param csvData CSV字符串数据
     * @param options 解析选项
     * @returns 表格数据
     */
    static fromCSV(csvData: string, options?: {
        hasHeader?: boolean;
        delimiter?: string;
        styleName?: string;
    }): TableData;
    /**
     * 从JSON数据创建表格
     * @param jsonData JSON字符串或对象数组
     * @param options 转换选项
     * @returns 表格数据
     */
    static fromJSON(jsonData: string | any[], options?: {
        columns?: string[];
        styleName?: string;
    }): TableData;
    /**
     * 创建带合并单元格的表格
     * @param rows 行数据，包含合并配置
     * @param styleName 样式名称
     * @returns 表格数据
     */
    static createWithMerge(rows: TableCellConfig[][], styleName?: string): TableData;
    /**
     * 获取预定义样式
     * @param styleName 样式名称
     * @returns 表格样式或undefined
     */
    static getPresetStyle(styleName: string): TableStyle | undefined;
    /**
     * 获取所有预定义样式名称
     * @returns 样式名称数组
     */
    static getPresetStyleNames(): string[];
    /**
     * 列出所有预定义样式
     * @returns 样式信息数组
     */
    static listPresetStyles(): Array<{
        name: string;
        description: string;
    }>;
    /**
     * 验证表格数据
     * @param tableData 表格数据
     * @returns 验证结果
     */
    static validate(tableData: TableData): {
        valid: boolean;
        errors: string[];
    };
}
//# sourceMappingURL=tableProcessor.d.ts.map