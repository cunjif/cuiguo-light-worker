import type { DocumentConverter, StreamInfo, ConverterInput, InternalConvertOptions, ConvertResult } from '../types.js';
export declare class EpubConverter implements DocumentConverter {
    private htmlConverter;
    private parser;
    accepts(info: StreamInfo): boolean;
    convert(input: ConverterInput, _info: StreamInfo, opts: InternalConvertOptions): Promise<ConvertResult | null>;
    private getTextValue;
    private getAllTextValues;
    private capitalize;
    private readZipText;
    private ensureArray;
}
