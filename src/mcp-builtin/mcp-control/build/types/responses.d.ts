interface ImageContent {
    type: 'image';
    data: Buffer | string;
    mimeType: string;
    encoding?: 'binary' | 'base64';
}
export interface ScreenshotResponse {
    screenshot: Buffer | string;
    timestamp: string;
    encoding: 'binary' | 'base64';
}
export interface WindowsControlResponse {
    success: boolean;
    message: string;
    data?: unknown;
    screenshot?: Buffer | string;
    content?: ImageContent[];
    encoding?: 'binary' | 'base64';
}
export {};
