// src/converters/rss.ts
import type { DocumentConverter, StreamInfo, ConverterInput, InternalConvertOptions, ConvertResult } from '../types.js';
import { HtmlConverter } from './html.js';
import { XMLParser } from 'fast-xml-parser';
import { SAFE_XML_OPTIONS } from '../xml-utils.js';

const PRECISE_EXTENSIONS = ['.rss', '.atom'];
const PRECISE_MIME_PREFIXES = [
  'application/rss',
  'application/rss+xml',
  'application/atom',
  'application/atom+xml',
];
const CANDIDATE_EXTENSIONS = ['.xml'];
const CANDIDATE_MIME_PREFIXES = ['text/xml', 'application/xml'];

export class RssConverter implements DocumentConverter {
  private htmlConverter = new HtmlConverter();

  accepts(info: StreamInfo): boolean {
    const ext = (info.extension ?? '').toLowerCase();
    const mime = (info.mimetype ?? '').toLowerCase();

    // Precise matches always accept
    if (PRECISE_EXTENSIONS.includes(ext)) return true;
    for (const prefix of PRECISE_MIME_PREFIXES) {
      if (mime.startsWith(prefix)) return true;
    }

    // Candidate matches (generic XML) also accept — we'll sniff in convert()
    if (CANDIDATE_EXTENSIONS.includes(ext)) return true;
    for (const prefix of CANDIDATE_MIME_PREFIXES) {
      if (mime.startsWith(prefix)) return true;
    }

    return false;
  }

  async convert(
    input: ConverterInput,
    _info: StreamInfo,
    _opts: InternalConvertOptions,
  ): Promise<ConvertResult | null> {
    const buffer = await input.buffer();
    const xml = new TextDecoder('utf-8').decode(buffer);

    const parser = new XMLParser(SAFE_XML_OPTIONS);
    let doc: any;
    try {
      doc = parser.parse(xml);
    } catch {
      return null;
    }

    const feedType = this.detectFeedType(doc);
    if (feedType === 'rss') {
      return this.parseRss(doc);
    } else if (feedType === 'atom') {
      return this.parseAtom(doc);
    }

    // Not an RSS/Atom feed — return null so other converters can try
    return null;
  }

  private detectFeedType(doc: any): 'rss' | 'atom' | null {
    if (doc.rss) return 'rss';
    if (doc.feed) {
      // Atom feeds have a root <feed> element with <entry> children
      const feed = doc.feed;
      if (feed.entry) return 'atom';
    }
    return null;
  }

  private async parseRss(doc: any): Promise<ConvertResult> {
    const rss = doc.rss;
    const channel = rss.channel;
    if (!channel) throw new Error('No channel found in RSS feed');

    const channelTitle = this.textValue(channel.title);
    const channelDescription = this.textValue(channel.description);

    let md = '';
    if (channelTitle) md += `# ${channelTitle}\n`;
    if (channelDescription) md += `${channelDescription}\n`;

    const items = this.ensureArray(channel.item);
    for (const item of items) {
      const title = this.textValue(item.title);
      const description = this.textValue(item.description);
      const pubDate = this.textValue(item.pubDate);
      // content:encoded — fast-xml-parser renders namespaced tags with colon
      const content = this.textValue(item['content:encoded']);

      if (title) md += `\n## ${title}\n`;
      if (pubDate) md += `Published on: ${pubDate}\n`;
      if (description) md += await this.parseContent(description);
      if (content) md += await this.parseContent(content);
    }

    return { markdown: md, title: channelTitle ?? undefined };
  }

  private async parseAtom(doc: any): Promise<ConvertResult> {
    const feed = doc.feed;
    const feedTitle = this.textValue(feed.title);
    const subtitle = this.textValue(feed.subtitle);

    let md = '';
    if (feedTitle) md += `# ${feedTitle}\n`;
    if (subtitle) md += `${subtitle}\n`;

    const entries = this.ensureArray(feed.entry);
    for (const entry of entries) {
      const title = this.textValue(entry.title);
      const summary = this.textValue(entry.summary);
      const updated = this.textValue(entry.updated);
      const content = this.textValue(entry.content);

      if (title) md += `\n## ${title}\n`;
      if (updated) md += `Updated on: ${updated}\n`;
      if (summary) md += await this.parseContent(summary);
      if (content) md += await this.parseContent(content);
    }

    return { markdown: md, title: feedTitle ?? undefined };
  }

  private async parseContent(content: string): Promise<string> {
    try {
      const result = await this.htmlConverter.convertHtml(content);
      return result.markdown + '\n';
    } catch {
      return content + '\n';
    }
  }

  private textValue(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    // fast-xml-parser may wrap text with attributes in an object with #text
    if (typeof value === 'object' && '#text' in (value as any)) {
      return String((value as any)['#text']);
    }
    return null;
  }

  private ensureArray(value: unknown): any[] {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  }
}
