import type { DocumentConverter, StreamInfo, ConverterInput, InternalConvertOptions, ConvertResult } from '../types.js';
/**
 * File types supported by Azure Document Intelligence.
 */
export type DocumentIntelligenceFileType = 'docx' | 'pptx' | 'xlsx' | 'html' | 'pdf' | 'jpeg' | 'png' | 'bmp' | 'tiff';
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
export declare class DocumentIntelligenceConverter implements DocumentConverter {
    private readonly endpoint;
    private readonly credential;
    private readonly apiVersion;
    private readonly fileTypes;
    private readonly acceptedExtensions;
    private readonly acceptedMimePrefixes;
    constructor(options: DocumentIntelligenceConverterOptions);
    accepts(info: StreamInfo): boolean;
    /**
     * Determine which analysis features are available for this file type.
     * Office file types (docx, pptx, xlsx, html) don't support OCR features.
     */
    private needsOcr;
    convert(input: ConverterInput, info: StreamInfo, _opts: InternalConvertOptions): Promise<ConvertResult | null>;
}
