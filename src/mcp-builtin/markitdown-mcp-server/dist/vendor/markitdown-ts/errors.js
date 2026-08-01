// src/errors.ts
export class MarkItDownError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}
export class MissingDependencyError extends MarkItDownError {
    dependency;
    installCommand;
    constructor(dependency, installCommand) {
        super(`Missing dependency: ${dependency}. Install it with: ${installCommand}`);
        this.dependency = dependency;
        this.installCommand = installCommand;
    }
}
export class UnsupportedFormatError extends MarkItDownError {
    constructor(detail) {
        super(`Unsupported format: ${detail}`);
    }
}
export class FileConversionError extends MarkItDownError {
    attempts;
    constructor(attempts) {
        const names = attempts.map((a) => a.converter).join(', ');
        super(`Conversion failed. Attempted converters: ${names}`);
        this.attempts = attempts;
    }
}
export class FileTooLargeError extends MarkItDownError {
    size;
    limit;
    constructor(size, limit) {
        super(`File too large: ${size} bytes exceeds limit of ${limit} bytes`);
        this.size = size;
        this.limit = limit;
    }
}
//# sourceMappingURL=errors.js.map