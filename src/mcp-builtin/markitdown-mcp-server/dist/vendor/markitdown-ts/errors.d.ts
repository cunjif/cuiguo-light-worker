export declare class MarkItDownError extends Error {
    constructor(message: string);
}
export declare class MissingDependencyError extends MarkItDownError {
    readonly dependency: string;
    readonly installCommand: string;
    constructor(dependency: string, installCommand: string);
}
export declare class UnsupportedFormatError extends MarkItDownError {
    constructor(detail: string);
}
export interface FailedConversionAttempt {
    converter: string;
    error: Error;
}
export declare class FileConversionError extends MarkItDownError {
    readonly attempts: FailedConversionAttempt[];
    constructor(attempts: FailedConversionAttempt[]);
}
export declare class FileTooLargeError extends MarkItDownError {
    readonly size: number;
    readonly limit: number;
    constructor(size: number, limit: number);
}
