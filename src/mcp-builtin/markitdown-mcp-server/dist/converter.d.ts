export declare function inferFileType(filePath: string, typeHint?: string): string;
export interface ConvertFileResult {
    success: boolean;
    markdown?: string;
    title?: string;
    error?: string;
}
export declare function convertFile(filePath: string, type?: string): Promise<ConvertFileResult>;
