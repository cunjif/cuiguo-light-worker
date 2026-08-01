import type { DocumentConverter, StreamInfo, ConverterInput, InternalConvertOptions, ConvertResult } from '../types.js';
export declare class AudioConverter implements DocumentConverter {
    accepts(info: StreamInfo): boolean;
    convert(input: ConverterInput, info: StreamInfo, opts: InternalConvertOptions): Promise<ConvertResult | null>;
}
