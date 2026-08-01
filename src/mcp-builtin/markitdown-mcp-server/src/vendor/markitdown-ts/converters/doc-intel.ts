// src/converters/doc-intel.ts
import type {
  DocumentConverter,
  StreamInfo,
  ConverterInput,
  InternalConvertOptions,
  ConvertResult,
} from '../types.js';
import { MissingDependencyError } from '../errors.js';

/**
 * File types supported by Azure Document Intelligence.
 */
export type DocumentIntelligenceFileType =
  | 'docx'
  | 'pptx'
  | 'xlsx'
  | 'html'
  | 'pdf'
  | 'jpeg'
  | 'png'
  | 'bmp'
  | 'tiff';

const ALL_FILE_TYPES: DocumentIntelligenceFileType[] = [
  'docx', 'pptx', 'xlsx', 'pdf', 'jpeg', 'png', 'bmp', 'tiff',
];

function getMimePrefixes(types: DocumentIntelligenceFileType[]): string[] {
  const prefixes: string[] = [];
  for (const t of types) {
    switch (t) {
      case 'docx':
        prefixes.push('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        break;
      case 'pptx':
        prefixes.push('application/vnd.openxmlformats-officedocument.presentationml');
        break;
      case 'xlsx':
        prefixes.push('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        break;
      case 'html':
        prefixes.push('text/html', 'application/xhtml+xml');
        break;
      case 'pdf':
        prefixes.push('application/pdf', 'application/x-pdf');
        break;
      case 'jpeg':
        prefixes.push('image/jpeg');
        break;
      case 'png':
        prefixes.push('image/png');
        break;
      case 'bmp':
        prefixes.push('image/bmp');
        break;
      case 'tiff':
        prefixes.push('image/tiff');
        break;
    }
  }
  return prefixes;
}

function getFileExtensions(types: DocumentIntelligenceFileType[]): string[] {
  const exts: string[] = [];
  for (const t of types) {
    switch (t) {
      case 'docx': exts.push('.docx'); break;
      case 'pptx': exts.push('.pptx'); break;
      case 'xlsx': exts.push('.xlsx'); break;
      case 'html': exts.push('.html'); break;
      case 'pdf': exts.push('.pdf'); break;
      case 'jpeg': exts.push('.jpg', '.jpeg'); break;
      case 'png': exts.push('.png'); break;
      case 'bmp': exts.push('.bmp'); break;
      case 'tiff': exts.push('.tiff'); break;
    }
  }
  return exts;
}

/** Types that don't support OCR analysis features */
const NO_OCR_TYPES: DocumentIntelligenceFileType[] = ['docx', 'pptx', 'xlsx', 'html'];

export interface DocumentIntelligenceConverterOptions {
  endpoint: string;
  credential?: unknown;
  apiVersion?: string;
  fileTypes?: DocumentIntelligenceFileType[];
}

/**
 * Converter that uses Azure Document Intelligence REST API to extract
 * markdown from documents. Only instantiated when `docintelEndpoint` is
 * provided in MarkItDown options.
 *
 * Requires optional peer dependencies:
 * - @azure-rest/ai-document-intelligence
 * - @azure/identity (for DefaultAzureCredential)
 */
export class DocumentIntelligenceConverter implements DocumentConverter {
  private readonly endpoint: string;
  private readonly credential: unknown;
  private readonly apiVersion: string;
  private readonly fileTypes: DocumentIntelligenceFileType[];
  private readonly acceptedExtensions: string[];
  private readonly acceptedMimePrefixes: string[];

  constructor(options: DocumentIntelligenceConverterOptions) {
    this.endpoint = options.endpoint;
    this.credential = options.credential;
    this.apiVersion = options.apiVersion ?? '2024-07-31-preview';
    this.fileTypes = options.fileTypes ?? ALL_FILE_TYPES;
    this.acceptedExtensions = getFileExtensions(this.fileTypes);
    this.acceptedMimePrefixes = getMimePrefixes(this.fileTypes);
  }

  accepts(info: StreamInfo): boolean {
    const ext = info.extension?.toLowerCase();
    if (ext && this.acceptedExtensions.includes(ext)) return true;

    const mime = info.mimetype?.toLowerCase() ?? '';
    for (const prefix of this.acceptedMimePrefixes) {
      if (mime.startsWith(prefix)) return true;
    }

    return false;
  }

  /**
   * Determine which analysis features are available for this file type.
   * Office file types (docx, pptx, xlsx, html) don't support OCR features.
   */
  private needsOcr(info: StreamInfo): boolean {
    const ext = info.extension?.toLowerCase();
    const mime = info.mimetype?.toLowerCase() ?? '';
    const noOcrExtensions = getFileExtensions(NO_OCR_TYPES);
    const noOcrMimePrefixes = getMimePrefixes(NO_OCR_TYPES);

    if (ext && noOcrExtensions.includes(ext)) return false;
    for (const prefix of noOcrMimePrefixes) {
      if (mime.startsWith(prefix)) return false;
    }
    return true;
  }

  async convert(
    input: ConverterInput,
    info: StreamInfo,
    _opts: InternalConvertOptions,
  ): Promise<ConvertResult | null> {
    // Dynamic import of Azure SDK
    let DocumentIntelligenceClient: any;
    let AzureKeyCredential: any;
    let DefaultAzureCredential: any;

    try {
      const diModule = await import('@azure-rest/ai-document-intelligence');
      DocumentIntelligenceClient = (diModule as any).default ?? diModule;
    } catch {
      throw new MissingDependencyError(
        '@azure-rest/ai-document-intelligence',
        'pnpm add @azure-rest/ai-document-intelligence',
      );
    }

    // Resolve credential
    let credential = this.credential;
    if (!credential) {
      const apiKey = typeof process !== 'undefined' ? process.env.AZURE_API_KEY : undefined;
      if (apiKey) {
        try {
          // Dynamic import — @azure/core-auth is an optional peer dependency
          const coreAuthModule: any = await (Function('return import("@azure/core-auth")')());
          const AKC = coreAuthModule.AzureKeyCredential;
          credential = new AKC(apiKey);
        } catch {
          // If @azure/core-auth not available, try constructing inline
          credential = { key: apiKey };
        }
      } else {
        try {
          const identityModule = await import('@azure/identity');
          DefaultAzureCredential = identityModule.DefaultAzureCredential;
          credential = new DefaultAzureCredential();
        } catch {
          throw new MissingDependencyError(
            '@azure/identity',
            'pnpm add @azure/identity',
          );
        }
      }
    }

    const client = DocumentIntelligenceClient(this.endpoint, credential, {
      apiVersion: this.apiVersion,
    });

    const buffer = await input.buffer();

    // Determine analysis features based on file type
    const features = this.needsOcr(info) ? ['formulas', 'ocrHighResolution', 'styleFont'] : [];

    // Begin document analysis
    const initialResponse = await client
      .path('/documentModels/{modelId}:analyze', 'prebuilt-layout')
      .post({
        contentType: 'application/octet-stream',
        body: buffer,
        queryParameters: {
          outputContentFormat: 'markdown',
          ...(features.length > 0 ? { features } : {}),
        },
      });

    // Poll for result
    const poller = await client.getLongRunningPoller(initialResponse);
    const result = await poller.pollUntilDone();

    if (result.body?.analyzeResult?.content) {
      // Strip HTML comments from the markdown content
      const markdown = result.body.analyzeResult.content.replace(/<!--[\s\S]*?-->/g, '');
      return { markdown };
    }

    return { markdown: '' };
  }
}
