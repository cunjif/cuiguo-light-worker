// src/index.ts
import { MarkItDown } from './markitdown.js';
import type { MarkItDownOptions, ConvertOptions, ConvertResult } from './types.js';

export { MarkItDown };

export enum FileType {
  PDF = 'pdf',
  DOCX = 'docx',
  XLSX = 'xlsx',
  XLS = 'xls',
  PPTX = 'pptx',
  HTML = 'html',
  CSV = 'csv',
  EPUB = 'epub',
  RSS = 'rss',
  ATOM = 'atom',
  XML = 'xml',
  IPYNB = 'ipynb',
  JSON = 'json',
  JSONL = 'jsonl',
  TXT = 'txt',
  MD = 'md',
  MSG = 'msg',
  ZIP = 'zip',
  JPG = 'jpg',
  JPEG = 'jpeg',
  PNG = 'png',
  GIF = 'gif',
  BMP = 'bmp',
  TIFF = 'tiff',
  WEBP = 'webp',
  SVG = 'svg',
  MP3 = 'mp3',
  WAV = 'wav',
  M4A = 'm4a',
  OGG = 'ogg',
  FLAC = 'flac',
  AAC = 'aac',
  WMA = 'wma',
  MP4 = 'mp4',
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
  config?: { url?: string; responseType?: string };
}

function isAxiosLike(source: unknown): source is AxiosLikeResponse {
  return (
    typeof source === 'object' &&
    source !== null &&
    'data' in source &&
    'headers' in source &&
    !(source instanceof Response)
  );
}

function toBuffer(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof data === 'string') return new TextEncoder().encode(data);
  throw new Error(
    'Axios response data must be an ArrayBuffer or Buffer. ' +
    'Set responseType: "arraybuffer" in your Axios request for binary files.',
  );
}

function extractAxiosInfo(res: AxiosLikeResponse): { buffer: Uint8Array; mimetype?: string; charset?: string; filename?: string; url?: string } {
  const buffer = toBuffer(res.data);

  const contentType = String(res.headers['content-type'] ?? '');
  const [mimeRaw, ...params] = contentType.split(';');
  const mimetype = mimeRaw.trim() || undefined;
  let charset: string | undefined;
  for (const param of params) {
    const [key, val] = param.split('=').map((s) => s.trim());
    if (key === 'charset' && val) charset = val;
  }

  const disposition = String(res.headers['content-disposition'] ?? '');
  let filename: string | undefined;
  const fnMatch = disposition.match(/filename[*]?=(?:UTF-8''|"?)([^";]+)/i);
  if (fnMatch) filename = decodeURIComponent(fnMatch[1]);

  const url = res.config?.url;

  return { buffer, mimetype, charset, filename, url };
}

/**
 * Convert a file to Markdown in one call.
 *
 * Accepts a file path, URL, data URI, Uint8Array/Buffer, fetch Response,
 * or Axios response.
 */
export async function markitdown(
  source: string | Uint8Array | Response | AxiosLikeResponse,
  options?: MarkItDownInput,
): Promise<ConvertResult> {
  const {
    type,
    keepDataUris,
    allowUrlFetch,
    ...mdOptions
  } = options ?? {};

  const typeInfo = type ? { extension: '.' + type } : {};
  const md = new MarkItDown(mdOptions);

  if (typeof source === 'string') {
    return md.convert(source, { keepDataUris, allowUrlFetch, streamInfo: typeInfo });
  }

  if (source instanceof Response) {
    return md.convertResponse(source, { keepDataUris, allowUrlFetch, streamInfo: typeInfo });
  }

  if (isAxiosLike(source)) {
    const ax = extractAxiosInfo(source);
    return md.convertBuffer(ax.buffer, {
      keepDataUris,
      allowUrlFetch,
      streamInfo: {
        mimetype: ax.mimetype,
        charset: ax.charset,
        filename: ax.filename,
        url: ax.url,
        ...typeInfo,
      },
    });
  }

  // Uint8Array / Buffer
  return md.convertBuffer(source, { keepDataUris, allowUrlFetch, streamInfo: typeInfo });
}

export type {
  StreamInfo,
  ConvertResult,
  ConvertOptions,
  ConverterInput,
  DocumentConverter,
  ConverterRegistration,
  InternalConvertOptions,
  NodeServices,
  MarkItDownOptions,
  MarkItDownPlugin,
  MarkItDownRegistrar,
} from './types.js';
export {
  MarkItDownError,
  MissingDependencyError,
  UnsupportedFormatError,
  FileConversionError,
  FileTooLargeError,
} from './errors.js';
export type { FailedConversionAttempt } from './errors.js';
export { PRIORITY_SPECIFIC, PRIORITY_GENERIC } from './constants.js';
