// src/converters/zip.ts
import type {
  DocumentConverter,
  StreamInfo,
  ConverterInput,
  InternalConvertOptions,
  ConvertResult,
} from '../types.js';
import { MissingDependencyError } from '../errors.js';

const ACCEPTED_EXTENSIONS = ['.zip'];
const ACCEPTED_MIME_PREFIXES = ['application/zip'];

/**
 * Sanitize a ZIP entry name to prevent path traversal attacks.
 * Returns null if the entry name is unsafe (absolute path or traversal).
 */
function sanitizeEntryName(name: string): string | null {
  // Reject absolute paths
  if (name.startsWith('/') || name.startsWith('\\')) return null;
  if (/^[A-Za-z]:[\\/]/.test(name)) return null;

  // Strip leading ../ sequences
  let sanitized = name;
  while (sanitized.startsWith('../') || sanitized.startsWith('..\\')) {
    sanitized = sanitized.slice(3);
  }

  // Reject if still contains path traversal
  if (sanitized.includes('../') || sanitized.includes('..\\')) return null;

  return sanitized;
}

/**
 * Extract the file extension from a path.
 */
function extractExtension(filepath: string): string | undefined {
  const basename = filepath.split('/').pop() ?? filepath;
  const dot = basename.lastIndexOf('.');
  if (dot === -1 || dot === basename.length - 1) return undefined;
  return basename.slice(dot).toLowerCase();
}

export class ZipConverter implements DocumentConverter {
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
    let JSZip: typeof import('jszip');
    try {
      const mod = await import('jszip');
      JSZip = (mod as any).default ?? mod;
    } catch {
      throw new MissingDependencyError('jszip', 'pnpm add jszip');
    }

    const buffer = await input.buffer();
    const zip = await JSZip.loadAsync(buffer);

    const filePath = info.url ?? info.localPath ?? info.filename ?? 'archive.zip';
    let mdContent = `Content from the zip file \`${filePath}\`:\n\n`;

    // Calculate total uncompressed size and enforce limit
    let totalSize = 0;
    const fileEntries: Array<{ name: string; entry: import('jszip').JSZipObject }> = [];

    zip.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir) {
        const sanitizedName = sanitizeEntryName(relativePath);
        if (sanitizedName) {
          fileEntries.push({ name: sanitizedName, entry: zipEntry });
          // _data.uncompressedSize may not be available in all JSZip versions
          // We'll check size after extraction if needed
        }
      }
    });

    // Process files sequentially to maintain consistent ordering
    for (const { name, entry } of fileEntries) {
      try {
        const fileBuffer = await entry.async('uint8array');

        // Check uncompressed size
        totalSize += fileBuffer.length;
        if (totalSize > opts.maxUncompressedSize) {
          mdContent += `\n## File: ${name}\n\n*Skipped: total uncompressed size exceeds limit*\n\n`;
          break;
        }

        // Attempt recursive conversion
        if (opts.convertBuffer) {
          try {
            const ext = extractExtension(name);
            const basename = name.split('/').pop() ?? name;
            const result = await opts.convertBuffer(fileBuffer, {
              streamInfo: {
                filename: basename,
                extension: ext,
              },
            });
            mdContent += `## File: ${name}\n\n`;
            mdContent += result.markdown + '\n\n';
          } catch {
            // Unsupported format or conversion failure — skip silently
          }
        }
      } catch {
        // Extraction failure — skip silently
      }
    }

    return { markdown: mdContent.trim() };
  }
}
