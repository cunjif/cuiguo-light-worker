import type { MarkItDownOptions, ConvertOptions, ConvertResult, DocumentConverter, MarkItDownRegistrar } from './types.js';
export declare class MarkItDown implements MarkItDownRegistrar {
    private registry;
    private options;
    constructor(options?: MarkItDownOptions);
    registerConverter(converter: DocumentConverter, options: {
        priority?: number;
        extensions: string[];
        mimeTypes: string[];
    }): void;
    convert(source: string, options?: ConvertOptions): Promise<ConvertResult>;
    convertBuffer(buffer: Uint8Array, options?: ConvertOptions): Promise<ConvertResult>;
    convertStream(stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream, options?: ConvertOptions): Promise<ConvertResult>;
    convertResponse(response: Response, options?: ConvertOptions): Promise<ConvertResult>;
    private buildLlmCaption;
    private dispatch;
    private enableBuiltins;
}
