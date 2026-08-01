import { MarkItDown } from './markitdown.js';
import type { MarkItDownOptions, ConvertResult } from './types.js';
export { MarkItDown };
export declare enum FileType {
    PDF = "pdf",
    DOCX = "docx",
    XLSX = "xlsx",
    XLS = "xls",
    PPTX = "pptx",
    HTML = "html",
    CSV = "csv",
    EPUB = "epub",
    RSS = "rss",
    ATOM = "atom",
    XML = "xml",
    IPYNB = "ipynb",
    JSON = "json",
    JSONL = "jsonl",
    TXT = "txt",
    MD = "md",
    MSG = "msg",
    ZIP = "zip",
    JPG = "jpg",
    JPEG = "jpeg",
    PNG = "png",
    GIF = "gif",
    BMP = "bmp",
    TIFF = "tiff",
    WEBP = "webp",
    SVG = "svg",
    MP3 = "mp3",
    WAV = "wav",
    M4A = "m4a",
    OGG = "ogg",
    FLAC = "flac",
    AAC = "aac",
    WMA = "wma",
    MP4 = "mp4"
}
export interface MarkItDownInput extends MarkItDownOptions {
    /** File type hint for format detection. Auto-detected from file paths, URLs, and response headers when not provided. */
    type?: FileType | `${FileType}`;
    /** Preserve base64 data URIs in output (default: false) */
    keepDataUris?: boolean;
    /** Allow fetching http/https URLs (default: false, SSRF protection) */
    allowUrlFetch?: boolean;
}
/** Duck-type check for Axios-style responses */
interface AxiosLikeResponse {
    data: unknown;
    headers: Record<string, unknown> & {
        'content-type'?: string;
        'content-disposition'?: string;
    };
    config?: {
        url?: string;
        responseType?: string;
    };
}
/**
 * Convert a file to Markdown in one call.
 *
 * Accepts a file path, URL, data URI, Uint8Array/Buffer, fetch Response,
 * or Axios response.
 */
export declare function markitdown(source: string | Uint8Array | Response | AxiosLikeResponse, options?: MarkItDownInput): Promise<ConvertResult>;
export type { StreamInfo, ConvertResult, ConvertOptions, ConverterInput, DocumentConverter, ConverterRegistration, InternalConvertOptions, NodeServices, MarkItDownOptions, MarkItDownPlugin, MarkItDownRegistrar, } from './types.js';
export { MarkItDownError, MissingDependencyError, UnsupportedFormatError, FileConversionError, FileTooLargeError, } from './errors.js';
export type { FailedConversionAttempt } from './errors.js';
export { PRIORITY_SPECIFIC, PRIORITY_GENERIC } from './constants.js';
