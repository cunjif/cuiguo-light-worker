export interface ValidationResult {
    valid: boolean;
    error?: string;
}
export declare function validateFilePath(filePath: string): ValidationResult;
