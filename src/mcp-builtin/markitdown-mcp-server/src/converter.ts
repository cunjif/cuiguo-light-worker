import * as fs from 'node:fs';
import * as path from 'node:path';
import { MarkItDown, MissingDependencyError, UnsupportedFormatError, FileTooLargeError, FileType } from './vendor/markitdown-ts/index.js';
import * as logger from './logger.js';

let markItDownInstance: MarkItDown | null = null;
let initFailedReason: string | null = null;

function getMarkItDown(): MarkItDown {
  if (markItDownInstance) return markItDownInstance;
  if (initFailedReason) {
    throw new Error(`markitdown-ts engine unavailable: ${initFailedReason}`);
  }
  try {
    markItDownInstance = new MarkItDown();
    return markItDownInstance;
  } catch (e: any) {
    initFailedReason = e?.message || String(e);
    logger.error('MarkItDown initialization failed', { reason: initFailedReason });
    throw new Error(`markitdown-ts engine unavailable: ${initFailedReason}`);
  }
}

const EXTENSION_TO_FILETYPE: Record<string, string> = {
  pdf: 'pdf', docx: 'docx', doc: 'docx', xlsx: 'xlsx', xls: 'xlsx',
  pptx: 'pptx', ppt: 'pptx', html: 'html', htm: 'html', csv: 'csv',
  epub: 'epub', rss: 'rss', atom: 'atom', xml: 'xml', ipynb: 'ipynb',
  json: 'json', jsonl: 'jsonl', txt: 'txt', md: 'md', markdown: 'md',
  msg: 'msg', zip: 'zip', jpg: 'jpg', jpeg: 'jpeg', png: 'png',
  gif: 'gif', bmp: 'bmp', tiff: 'tiff', tif: 'tiff', webp: 'webp',
  svg: 'svg', mp3: 'mp3', wav: 'wav', m4a: 'm4a', ogg: 'ogg',
  flac: 'flac', aac: 'aac', wma: 'wma', mp4: 'mp4',
};

const VALID_FILE_TYPES = new Set<string>(Object.values(FileType));

export function inferFileType(filePath: string, typeHint?: string): string {
  if (typeHint) {
    if (VALID_FILE_TYPES.has(typeHint)) {
      return typeHint;
    }
    const lowerHint = typeHint.toLowerCase();
    if (VALID_FILE_TYPES.has(lowerHint)) {
      return lowerHint;
    }
  }

  const ext = path.extname(filePath).toLowerCase().slice(1);
  if (!ext) {
    throw new Error('Unsupported file format: no extension');
  }

  const mapped = EXTENSION_TO_FILETYPE[ext];
  if (!mapped) {
    throw new Error(`Unsupported file format: ${ext}`);
  }

  return mapped;
}

export interface ConvertFileResult {
  success: boolean;
  markdown?: string;
  title?: string;
  error?: string;
}

export async function convertFile(filePath: string, type?: string): Promise<ConvertFileResult> {
  let engine: MarkItDown;
  try {
    engine = getMarkItDown();
  } catch (e: any) {
    return { success: false, error: e.message };
  }

  const fileType = inferFileType(filePath, type);
  const ext = path.extname(filePath).toLowerCase().slice(1) || fileType;

  let buffer: Uint8Array;
  try {
    const fileContent = fs.readFileSync(filePath);
    buffer = new Uint8Array(fileContent);
  } catch (e: any) {
    return { success: false, error: `Failed to read file: ${e.message}` };
  }

  try {
    const result = await engine.convertBuffer(buffer, { streamInfo: { extension: '.' + fileType } });
    const markdown = result?.markdown || '';
    if (!markdown.trim()) {
      return { success: false, error: 'Conversion returned empty content' };
    }
    return { success: true, markdown, title: result?.title || undefined };
  } catch (e: any) {
    if (e instanceof MissingDependencyError) {
      return {
        success: false,
        error: `Missing dependency: ${e.dependency}. Install with: ${e.installCommand}`,
      };
    }
    if (e instanceof UnsupportedFormatError) {
      return { success: false, error: `Unsupported file format: ${ext}` };
    }
    if (e instanceof FileTooLargeError) {
      return {
        success: false,
        error: `File too large: ${e.size} bytes exceeds limit of ${e.limit} bytes`,
      };
    }
    logger.error('Conversion failed', { error: e?.message || String(e) });
    return { success: false, error: `Conversion failed: ${e?.message || e}` };
  }
}