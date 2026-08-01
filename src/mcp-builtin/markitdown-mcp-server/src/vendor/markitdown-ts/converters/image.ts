// src/converters/image.ts
import type {
  DocumentConverter,
  StreamInfo,
  ConverterInput,
  InternalConvertOptions,
  ConvertResult,
} from '../types.js';

const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg'];
const ACCEPTED_MIME_PREFIXES = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff', 'image/webp', 'image/svg'];

const METADATA_FIELDS = [
  'ImageSize',
  'Title',
  'Caption',
  'Description',
  'Keywords',
  'Artist',
  'Author',
  'DateTimeOriginal',
  'CreateDate',
  'GPSPosition',
];

export class ImageConverter implements DocumentConverter {
  accepts(info: StreamInfo): boolean {
    const ext = info.extension?.toLowerCase();
    if (ext && ACCEPTED_EXTENSIONS.includes(ext)) return true;

    const mime = info.mimetype?.toLowerCase() ?? '';
    for (const prefix of ACCEPTED_MIME_PREFIXES) {
      if (mime.startsWith(prefix)) return true;
    }

    return false;
  }

  async convert(
    input: ConverterInput,
    info: StreamInfo,
    opts: InternalConvertOptions,
  ): Promise<ConvertResult | null> {
    const filename = info.filename ?? info.localPath ?? 'image';
    let mdContent = `# Image: ${filename}\n`;

    // Extract EXIF metadata if exiftool is available
    if (opts.nodeServices?.exiftool) {
      try {
        const metadata = await opts.nodeServices.exiftool(input, info);
        if (metadata && Object.keys(metadata).length > 0) {
          const metadataLines: string[] = [];
          for (const field of METADATA_FIELDS) {
            if (field in metadata) {
              metadataLines.push(`- **${field}:** ${metadata[field]}`);
            }
          }
          if (metadataLines.length > 0) {
            mdContent += '\n## Metadata\n\n' + metadataLines.join('\n') + '\n';
          }
        }
      } catch {
        // Graceful degradation: exiftool failed, continue without metadata
      }
    }

    // Try LLM caption if configured
    if (opts.llmCaption) {
      try {
        const buffer = await input.buffer();
        const mimeType = info.mimetype ?? 'application/octet-stream';
        const description = await opts.llmCaption(buffer, mimeType);
        if (description) {
          mdContent += '\n## Description\n\n' + description.trim() + '\n';
        }
      } catch {
        // Graceful degradation: LLM caption failed, continue without description
      }
    }

    return { markdown: mdContent.trim() };
  }
}
