// @ts-nocheck
// src/converters/epub.ts
import type { DocumentConverter, StreamInfo, ConverterInput, InternalConvertOptions, ConvertResult } from '../types.js';
import { MissingDependencyError } from '../errors.js';
import { HtmlConverter } from './html.js';
import { XMLParser } from '../../fast-xml-parser/src/fxp.js';
import { SAFE_XML_OPTIONS } from '../xml-utils.js';

const ACCEPTED_EXTENSIONS = ['.epub'];
const ACCEPTED_MIME_PREFIXES = [
  'application/epub',
  'application/epub+zip',
  'application/x-epub+zip',
];

export class EpubConverter implements DocumentConverter {
  private htmlConverter = new HtmlConverter();
  private parser = new XMLParser(SAFE_XML_OPTIONS);

  accepts(info: StreamInfo): boolean {
    const ext = (info.extension ?? '').toLowerCase();
    const mime = (info.mimetype ?? '').toLowerCase();

    if (ACCEPTED_EXTENSIONS.includes(ext)) return true;
    for (const prefix of ACCEPTED_MIME_PREFIXES) {
      if (mime.startsWith(prefix)) return true;
    }
    return false;
  }

  async convert(
    input: ConverterInput,
    _info: StreamInfo,
    opts: InternalConvertOptions,
  ): Promise<ConvertResult | null> {
    let JSZip: typeof import('../../jszip/lib/index.js');
    try {
      JSZip = await import('../../jszip/lib/index.js');
    } catch {
      throw new MissingDependencyError('jszip', 'pnpm add jszip');
    }

    const buffer = await input.buffer();
    const zip = await JSZip.default.loadAsync(buffer);

    // 1. Parse container.xml to find the OPF file path
    const containerXml = await this.readZipText(zip, 'META-INF/container.xml');
    if (!containerXml) return null;

    const containerDoc = this.parser.parse(containerXml);
    const container = containerDoc.container ?? containerDoc;
    const rootfiles = container.rootfiles ?? {};
    const rootfileNode = this.ensureArray(rootfiles.rootfile)[0];
    if (!rootfileNode) return null;

    const opfPath = rootfileNode['@_full-path'];
    if (!opfPath) return null;

    // 2. Parse the OPF file
    const opfXml = await this.readZipText(zip, opfPath);
    if (!opfXml) return null;

    const opfDoc = this.parser.parse(opfXml);
    const pkg = opfDoc.package ?? opfDoc;

    // 3. Extract metadata
    const metadata = pkg.metadata ?? {};
    const title = this.getTextValue(metadata['dc:title']);
    const authors = this.getAllTextValues(metadata['dc:creator']);
    const language = this.getTextValue(metadata['dc:language']);
    const publisher = this.getTextValue(metadata['dc:publisher']);
    const date = this.getTextValue(metadata['dc:date']);
    const description = this.getTextValue(metadata['dc:description']);
    const identifier = this.getTextValue(metadata['dc:identifier']);

    // 4. Build manifest: id -> href
    const manifestItems = this.ensureArray(
      (pkg.manifest ?? {}).item
    );
    const manifest = new Map<string, string>();
    for (const item of manifestItems) {
      const id = item['@_id'] ?? item['@_href'];
      const href = item['@_href'];
      if (id && href) manifest.set(id, href);
    }

    // 5. Get spine reading order
    const spineItems = this.ensureArray(
      (pkg.spine ?? {}).itemref
    );
    const spineOrder = spineItems.map((item: any) => item['@_idref']);

    // 6. Resolve spine to file paths
    const basePath = opfPath.includes('/')
      ? opfPath.split('/').slice(0, -1).join('/')
      : '';

    const spinePaths: string[] = [];
    for (const idref of spineOrder) {
      if (!idref || !manifest.has(idref)) continue;
      const href = manifest.get(idref)!;
      const fullPath = basePath ? `${basePath}/${href}` : href;
      spinePaths.push(fullPath);
    }

    // 7. Convert each spine item
    const markdownContent: string[] = [];
    let totalUncompressed = 0;

    for (const filePath of spinePaths) {
      const file = zip.file(filePath);
      if (!file) continue;

      const content = await file.async('string');
      totalUncompressed += content.length;

      if (totalUncompressed > opts.maxUncompressedSize) {
        break;
      }

      try {
        const result = await this.htmlConverter.convertHtml(content, opts.keepDataUris);
        markdownContent.push(result.markdown.trim());
      } catch {
        // Skip files that fail to convert
      }
    }

    // 8. Format metadata header
    const metadataEntries: Record<string, string | string[] | null | undefined> = {
      title,
      authors,
      language,
      publisher,
      date,
      description,
      identifier,
    };

    const metadataLines: string[] = [];
    for (const [key, value] of Object.entries(metadataEntries)) {
      let formatted: string | null = null;
      if (Array.isArray(value)) {
        const joined = value.join(', ');
        if (joined) formatted = joined;
      } else if (value) {
        formatted = value;
      }
      if (formatted) {
        metadataLines.push(`**${this.capitalize(key)}:** ${formatted}`);
      }
    }

    // Insert metadata at the beginning
    if (metadataLines.length > 0) {
      markdownContent.unshift(metadataLines.join('\n'));
    }

    return {
      markdown: markdownContent.join('\n\n'),
      title: title ?? undefined,
    };
  }

  private getTextValue(node: unknown): string | null {
    if (node == null) return null;
    if (typeof node === 'string') return node;
    if (typeof node === 'number' || typeof node === 'boolean') return String(node);
    if (typeof node === 'object' && '#text' in (node as any)) {
      return String((node as any)['#text']);
    }
    // Array: return first value
    if (Array.isArray(node)) {
      return this.getTextValue(node[0]);
    }
    return null;
  }

  private getAllTextValues(node: unknown): string[] {
    if (node == null) return [];
    const items = Array.isArray(node) ? node : [node];
    const values: string[] = [];
    for (const item of items) {
      const v = this.getTextValue(item);
      if (v) values.push(v);
    }
    return values;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private async readZipText(zip: any, path: string): Promise<string | null> {
    const file = zip.file(path);
    if (!file) return null;
    return file.async('string');
  }

  private ensureArray(value: unknown): any[] {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  }
}
