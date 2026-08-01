import type { StreamInfo } from './types.js';
export declare function extensionToMime(ext: string): string | undefined;
export declare function mimeToExtension(mime: string): string | undefined;
export declare function buildStreamInfo(partial: Partial<StreamInfo>): StreamInfo;
