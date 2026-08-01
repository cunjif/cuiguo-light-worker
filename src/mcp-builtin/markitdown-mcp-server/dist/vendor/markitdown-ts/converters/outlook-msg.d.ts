import type { DocumentConverter, StreamInfo, ConverterInput, InternalConvertOptions, ConvertResult } from '../types.js';
export declare class OutlookMsgConverter implements DocumentConverter {
    accepts(info: StreamInfo): boolean;
    convert(input: ConverterInput, _info: StreamInfo, _opts: InternalConvertOptions): Promise<ConvertResult | null>;
    /**
     * Extract and decode stream data from the MSG file.
     * Tries the Unicode (UTF-16LE) stream first, then falls back to ASCII/UTF-8.
     */
    private getStreamData;
}
