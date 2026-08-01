// src/converters/outlook-msg.ts
import type {
  DocumentConverter,
  StreamInfo,
  ConverterInput,
  InternalConvertOptions,
  ConvertResult,
} from '../types.js';
import { MissingDependencyError } from '../errors.js';

const ACCEPTED_EXTENSIONS = ['.msg'];
const ACCEPTED_MIME_PREFIXES = ['application/vnd.ms-outlook'];

// Property stream paths for email fields (UTF-16LE variants with 001F suffix)
const PROP_SUBJECT_UNICODE = '__substg1.0_0037001F';
const PROP_SUBJECT_ASCII = '__substg1.0_0037001E';
const PROP_FROM_UNICODE = '__substg1.0_0C1F001F';
const PROP_FROM_ASCII = '__substg1.0_0C1F001E';
const PROP_TO_UNICODE = '__substg1.0_0E04001F';
const PROP_TO_ASCII = '__substg1.0_0E04001E';
const PROP_BODY_UNICODE = '__substg1.0_1000001F';
const PROP_BODY_ASCII = '__substg1.0_1000001E';

export class OutlookMsgConverter implements DocumentConverter {
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
    _info: StreamInfo,
    _opts: InternalConvertOptions,
  ): Promise<ConvertResult | null> {
    let CFB: typeof import('cfb');
    try {
      CFB = await import('cfb');
    } catch {
      throw new MissingDependencyError('cfb', 'pnpm add cfb');
    }

    const buffer = await input.buffer();

    let container: import('cfb').CFB$Container;
    try {
      container = CFB.parse(buffer);
    } catch {
      // Not a valid CFB/OLE2 file
      return null;
    }

    // Extract email metadata
    let mdContent = '# Email Message\n\n';

    const headers: Record<string, string | null> = {
      From: this.getStreamData(CFB, container, PROP_FROM_UNICODE, PROP_FROM_ASCII),
      To: this.getStreamData(CFB, container, PROP_TO_UNICODE, PROP_TO_ASCII),
      Subject: this.getStreamData(CFB, container, PROP_SUBJECT_UNICODE, PROP_SUBJECT_ASCII),
    };

    // Add headers to markdown
    for (const [key, value] of Object.entries(headers)) {
      if (value) {
        mdContent += `**${key}:** ${value}\n`;
      }
    }

    mdContent += '\n## Content\n\n';

    // Get email body
    const body = this.getStreamData(CFB, container, PROP_BODY_UNICODE, PROP_BODY_ASCII);
    if (body) {
      mdContent += body;
    }

    return {
      markdown: mdContent.trim(),
      title: headers.Subject ?? undefined,
    };
  }

  /**
   * Extract and decode stream data from the MSG file.
   * Tries the Unicode (UTF-16LE) stream first, then falls back to ASCII/UTF-8.
   */
  private getStreamData(
    CFB: typeof import('cfb'),
    container: import('cfb').CFB$Container,
    unicodePath: string,
    asciiPath: string,
  ): string | null {
    // Try Unicode stream first
    const unicodeEntry = CFB.find(container, unicodePath);
    if (unicodeEntry?.content) {
      try {
        const data = unicodeEntry.content instanceof Uint8Array
          ? unicodeEntry.content
          : new Uint8Array(unicodeEntry.content);
        const text = new TextDecoder('utf-16le').decode(data).trim();
        // Remove null terminator if present
        return text.replace(/\0+$/, '');
      } catch {
        // Fall through to ASCII
      }
    }

    // Try ASCII/UTF-8 stream
    const asciiEntry = CFB.find(container, asciiPath);
    if (asciiEntry?.content) {
      try {
        const data = asciiEntry.content instanceof Uint8Array
          ? asciiEntry.content
          : new Uint8Array(asciiEntry.content);
        try {
          return new TextDecoder('utf-8').decode(data).trim();
        } catch {
          return new TextDecoder('utf-8', { fatal: false }).decode(data).trim();
        }
      } catch {
        // Fall through
      }
    }

    return null;
  }
}
