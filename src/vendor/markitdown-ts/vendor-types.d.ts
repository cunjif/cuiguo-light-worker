// Type stubs for optional peer dependencies that are not installed in this project.
// These packages are only needed at runtime for specific file formats (MSG, audio,
// EXIF, LLM captioning, Azure Document Intelligence, charset detection, file-type
// sniffing). When absent, the converters throw MissingDependencyError at runtime.
// These declarations allow TypeScript to type-check the vendored source without
// requiring the actual packages to be installed.

declare module 'ai' {
  export function generateText(options: any): Promise<{ text: string }>;
}

declare module 'cfb' {
  export type CFB$Container = any;
  export type CFB$Entry = { name?: string; content?: any; type?: number };
  export function parse(data: any): CFB$Container;
  export function find(c: CFB$Container, path: string): CFB$Entry | null;
}

declare module 'chardet' {
  export function detect(buffer: Uint8Array): string | null;
}

declare module 'file-type' {
  export function fileTypeFromBuffer(buffer: Uint8Array): Promise<{ ext: string; mime: string } | undefined>;
}

declare module 'exiftool-vendored' {
  export class ExifTool {
    read(path: string): Promise<Record<string, unknown>>;
    end(): Promise<void>;
  }
}

declare module '@azure-rest/ai-document-intelligence' {
  const _default: any;
  export default _default;
}

declare module '@azure/identity' {
  export class DefaultAzureCredential {
    getToken(scopes: string | string[]): Promise<{ token: string; expiresOnTimestamp: number }>;
  }
}

declare module 'papaparse' {
  export function parse(text: string, config?: any): any;
  const _default: { parse: typeof parse };
  export default _default;
}

declare module 'turndown' {
  const _default: any;
  export default _default;
}

declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  const _default: any;
  export default _default;
}