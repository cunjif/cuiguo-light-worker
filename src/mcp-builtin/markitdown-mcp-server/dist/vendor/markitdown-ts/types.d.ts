export type LanguageModelV1 = unknown;
export interface StreamInfo {
    readonly mimetype?: string;
    readonly extension?: string;
    readonly charset?: string;
    readonly filename?: string;
    readonly localPath?: string;
    readonly url?: string;
}
export interface ConvertResult {
    markdown: string;
    title?: string;
}
export interface ConvertOptions {
    streamInfo?: Partial<StreamInfo>;
    keepDataUris?: boolean;
    allowUrlFetch?: boolean;
}
export interface ConverterInput {
    stream: () => ReadableStream<Uint8Array>;
    buffer: () => Promise<Uint8Array>;
}
export interface DocumentConverter {
    accepts(info: StreamInfo): boolean;
    convert(input: ConverterInput, info: StreamInfo, opts: InternalConvertOptions): Promise<ConvertResult | null>;
}
export interface ConverterRegistration {
    converter: DocumentConverter;
    priority: number;
    extensions: string[];
    mimeTypes: string[];
}
export interface InternalConvertOptions {
    keepDataUris: boolean;
    maxBufferSize: number;
    maxUncompressedSize: number;
    llmCaption?: (buffer: Uint8Array, mimeType: string) => Promise<string>;
    nodeServices: NodeServices;
    styleMap?: string;
    parentConverters?: ConverterRegistration[];
    convertBuffer?: (buffer: Uint8Array, options?: ConvertOptions) => Promise<ConvertResult>;
}
export interface NodeServices {
    readFile?: (path: string) => Promise<Uint8Array>;
    exiftool?: (input: ConverterInput, info: StreamInfo) => Promise<Record<string, unknown>>;
    transcribeAudio?: (input: ConverterInput, info: StreamInfo) => Promise<string>;
    /**
     * Pre-resolved pdfjs-dist module (the namespace from
     * `import('pdfjs-dist/legacy/build/pdf.mjs')`). Provide this when the
     * consumer cannot rely on Node.js resolving `pdfjs-dist` via walk-up
     * from markitdown-ts's location — for example in bundled serverless
     * environments (Next.js on Vercel with pnpm) where markitdown-ts is
     * loaded outside the bundler's module graph and the peer-dependency
     * symlink can't be reached at runtime.
     *
     * When provided, PdfConverter uses this module directly instead of
     * attempting a dynamic import.
     */
    pdfjsLib?: unknown;
    /**
     * Optional pre-resolved pdfjs-dist worker module. Providing this
     * avoids the secondary `await import('pdfjs-dist/legacy/build/pdf.worker.mjs')`
     * that markitdown-ts otherwise performs inside PdfConverter. Same
     * rationale as pdfjsLib.
     */
    pdfjsWorker?: unknown;
    /**
     * Optional standard fonts directory URL used by pdfjs-dist. When the
     * consumer injects pdfjsLib, markitdown-ts cannot derive this path from
     * the package location, so it must be supplied explicitly (or left
     * undefined to skip font loading).
     */
    pdfjsStandardFontDataUrl?: string;
}
export interface MarkItDownOptions {
    enableBuiltins?: boolean;
    enablePlugins?: boolean;
    plugins?: MarkItDownPlugin[];
    llmModel?: LanguageModelV1;
    llmPrompt?: string;
    llmCaption?: (buffer: Uint8Array, mimeType: string) => Promise<string>;
    styleMap?: string;
    requestInit?: RequestInit;
    docintelEndpoint?: string;
    docintelCredential?: unknown;
    docintelFileTypes?: string[];
    docintelApiVersion?: string;
    maxBufferSize?: number;
    maxUncompressedSize?: number;
    nodeServices?: NodeServices;
}
export interface MarkItDownPlugin {
    name: string;
    version: string;
    register(md: MarkItDownRegistrar, options: Record<string, unknown>): void;
}
export interface MarkItDownRegistrar {
    registerConverter(converter: DocumentConverter, options: {
        priority?: number;
        extensions: string[];
        mimeTypes: string[];
    }): void;
}
