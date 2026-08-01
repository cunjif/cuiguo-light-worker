import type { DocumentConverter, StreamInfo, ConverterInput, InternalConvertOptions, ConvertResult } from '../types.js';
export declare class IpynbConverter implements DocumentConverter {
    accepts(info: StreamInfo): boolean;
    convert(input: ConverterInput, info: StreamInfo, _opts: InternalConvertOptions): Promise<ConvertResult | null>;
}
