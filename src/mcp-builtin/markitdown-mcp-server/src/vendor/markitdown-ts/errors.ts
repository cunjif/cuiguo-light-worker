// src/errors.ts

export class MarkItDownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class MissingDependencyError extends MarkItDownError {
  constructor(
    public readonly dependency: string,
    public readonly installCommand: string,
  ) {
    super(
      `Missing dependency: ${dependency}. Install it with: ${installCommand}`,
    );
  }
}

export class UnsupportedFormatError extends MarkItDownError {
  constructor(detail: string) {
    super(`Unsupported format: ${detail}`);
  }
}

export interface FailedConversionAttempt {
  converter: string;
  error: Error;
}

export class FileConversionError extends MarkItDownError {
  constructor(public readonly attempts: FailedConversionAttempt[]) {
    const names = attempts.map((a) => a.converter).join(', ');
    super(`Conversion failed. Attempted converters: ${names}`);
  }
}

export class FileTooLargeError extends MarkItDownError {
  constructor(
    public readonly size: number,
    public readonly limit: number,
  ) {
    super(
      `File too large: ${size} bytes exceeds limit of ${limit} bytes`,
    );
  }
}
