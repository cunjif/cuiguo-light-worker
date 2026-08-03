import { ClipboardInput } from '../types/common.js';
export declare function getClipboardContent(): Promise<{
    success: boolean;
    content?: string;
    error?: string;
}>;
export declare function setClipboardContent(input: ClipboardInput): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function hasClipboardText(): Promise<{
    success: boolean;
    hasText?: boolean;
    error?: string;
}>;
export declare function clearClipboard(): Promise<{
    success: boolean;
    error?: string;
}>;
