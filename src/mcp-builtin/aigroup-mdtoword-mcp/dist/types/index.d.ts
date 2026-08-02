export interface ConvertRequest {
    markdown?: string;
    inputPath?: string;
    filename: string;
    outputPath?: string;
    styleConfig?: import('./style.js').StyleConfig;
}
export interface ConvertResponse {
    success: boolean;
    filePath: string;
    filename: string;
}
export interface MarkdownConverter {
    convert(markdown: string): Promise<Buffer>;
}
export * from './style.js';
//# sourceMappingURL=index.d.ts.map