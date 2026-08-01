import type { DocumentConverter, StreamInfo, ConverterInput, InternalConvertOptions, ConvertResult } from '../types.js';
export declare class PdfConverter implements DocumentConverter {
    accepts(info: StreamInfo): boolean;
    convert(input: ConverterInput, _info: StreamInfo, _opts: InternalConvertOptions): Promise<ConvertResult | null>;
}
