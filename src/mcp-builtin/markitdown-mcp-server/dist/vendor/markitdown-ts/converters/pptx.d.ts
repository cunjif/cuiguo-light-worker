import type { DocumentConverter, StreamInfo, ConverterInput, InternalConvertOptions, ConvertResult } from '../types.js';
export declare class PptxConverter implements DocumentConverter {
    private htmlConverter;
    private parser;
    accepts(info: StreamInfo): boolean;
    convert(input: ConverterInput, _info: StreamInfo, opts: InternalConvertOptions): Promise<ConvertResult | null>;
    private processShape;
    private processGraphicFrame;
    private convertTable;
    private parseChart;
    private extractChartTitleText;
    private extractChartValues;
    private findTitleShapeId;
    private collectShapes;
    private collectGraphicFrames;
    private collectShapesFromGroup;
    private sortShapesByPosition;
    private getPosition;
    private extractTextFromTxBody;
    private extractNotesText;
    private readZipText;
    private escapeHtml;
    private ensureArray;
}
