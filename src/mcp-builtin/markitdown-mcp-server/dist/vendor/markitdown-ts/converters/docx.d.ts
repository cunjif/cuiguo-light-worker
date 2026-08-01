import type { DocumentConverter, StreamInfo, ConverterInput, InternalConvertOptions, ConvertResult } from '../types.js';
export declare class DocxConverter implements DocumentConverter {
    private htmlConverter;
    accepts(info: StreamInfo): boolean;
    convert(input: ConverterInput, info: StreamInfo, opts: InternalConvertOptions): Promise<ConvertResult | null>;
    private extractComments;
    private preProcessDocx;
}
