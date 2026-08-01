import type { DocumentConverter, StreamInfo, ConverterInput, InternalConvertOptions, ConvertResult } from '../types.js';
export declare class RssConverter implements DocumentConverter {
    private htmlConverter;
    accepts(info: StreamInfo): boolean;
    convert(input: ConverterInput, _info: StreamInfo, _opts: InternalConvertOptions): Promise<ConvertResult | null>;
    private detectFeedType;
    private parseRss;
    private parseAtom;
    private parseContent;
    private textValue;
    private ensureArray;
}
