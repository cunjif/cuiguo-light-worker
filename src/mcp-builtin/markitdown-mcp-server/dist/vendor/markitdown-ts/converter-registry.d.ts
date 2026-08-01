import type { DocumentConverter, ConverterRegistration, StreamInfo } from './types.js';
export declare class ConverterRegistry {
    private registrations;
    private extensionIndex;
    private mimeIndex;
    private fallbackConverters;
    private nextInsertOrder;
    private dirty;
    private sortedCache;
    register(converter: DocumentConverter, options: {
        priority?: number;
        extensions: string[];
        mimeTypes: string[];
    }): void;
    findConverters(info: StreamInfo): ConverterRegistration[];
    getAll(): ConverterRegistration[];
}
