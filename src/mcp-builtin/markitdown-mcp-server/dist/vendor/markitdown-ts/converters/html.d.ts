import type { DocumentConverter, StreamInfo, ConverterInput, InternalConvertOptions, ConvertResult } from '../types.js';
export declare class HtmlConverter implements DocumentConverter {
    accepts(info: StreamInfo): boolean;
    convert(input: ConverterInput, info: StreamInfo, opts: InternalConvertOptions): Promise<ConvertResult | null>;
    convertHtml(html: string, keepDataUris?: boolean): Promise<ConvertResult>;
}
