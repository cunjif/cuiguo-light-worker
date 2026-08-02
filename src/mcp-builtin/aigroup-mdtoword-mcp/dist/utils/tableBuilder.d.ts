import { Table } from 'docx';
import { TableData, TableStyle } from '../types/style.js';
/**
 * 表格构建器类 - 支持合并单元格和嵌套表格
 */
export declare class TableBuilder {
    /**
     * 从TableData创建DOCX表格
     * @param tableData 表格数据
     * @param defaultStyle 默认样式配置
     * @returns DOCX Table对象
     */
    static createTable(tableData: TableData, defaultStyle?: TableStyle): Table;
    /**
     * 创建表格行
     */
    private static createTableRow;
    /**
     * 创建表格单元格
     */
    private static createTableCell;
    /**
     * 获取单元格水平对齐方式
     */
    private static getAlignment;
    /**
     * 获取单元格垂直对齐方式
     */
    private static getVerticalAlignment;
    /**
     * 转换边框样式
     */
    private static convertBorders;
    /**
     * 转换文本样式
     */
    private static convertTextStyle;
    /**
     * 从简单的二维数组创建表格
     * @param data 二维字符串数组
     * @param styleName 样式名称
     * @returns DOCX Table对象
     */
    static fromSimpleArray(data: string[][], styleName?: string): Table;
}
//# sourceMappingURL=tableBuilder.d.ts.map