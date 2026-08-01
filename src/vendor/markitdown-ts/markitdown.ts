// src/markitdown.ts
import type {
  MarkItDownOptions,
  ConvertOptions,
  ConvertResult,
  StreamInfo,
  DocumentConverter,
  InternalConvertOptions,
  ConverterRegistration,
  NodeServices,
  MarkItDownRegistrar,
} from './types.js';
import { ConverterRegistry } from './converter-registry.js';
import { createConverterInputFromBuffer, createConverterInputFromStream } from './converter-input.js';
import { buildStreamInfo } from './stream-info.js';
import { normalizeOutput } from './normalize.js';
import { fileUriToPath, parseDataUri } from './uri-utils.js';
import {
  UnsupportedFormatError,
  FileConversionError,
  FileTooLargeError,
  type FailedConversionAttempt,
} from './errors.js';
import {
  DEFAULT_MAX_BUFFER_SIZE,
  DEFAULT_MAX_UNCOMPRESSED_SIZE,
  PRIORITY_GENERIC,
  PRIORITY_SPECIFIC,
} from './constants.js';
import { PlainTextConverter } from './converters/plain-text.js';
import { IpynbConverter } from './converters/ipynb.js';
import { CsvConverter } from './converters/csv.js';
import { HtmlConverter } from './converters/html.js';
import { DocxConverter } from './converters/docx.js';
import { RssConverter } from './converters/rss.js';
import { XlsxConverter } from './converters/xlsx.js';
import { PptxConverter } from './converters/pptx.js';
import { EpubConverter } from './converters/epub.js';
import { PdfConverter } from './converters/pdf.js';
import { ImageConverter } from './converters/image.js';
import { AudioConverter } from './converters/audio.js';
import { OutlookMsgConverter } from './converters/outlook-msg.js';
import { ZipConverter } from './converters/zip.js';
import { DocumentIntelligenceConverter } from './converters/doc-intel.js';

export class MarkItDown implements MarkItDownRegistrar {
  private registry = new ConverterRegistry();
  private options: Required<
    Pick<MarkItDownOptions, 'maxBufferSize' | 'maxUncompressedSize'>
  > & MarkItDownOptions;

  constructor(options: MarkItDownOptions = {}) {
    this.options = {
      ...options,
      maxBufferSize: options.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE,
      maxUncompressedSize: options.maxUncompressedSize ?? DEFAULT_MAX_UNCOMPRESSED_SIZE,
    };

    if (options.enableBuiltins !== false) {
      this.enableBuiltins();
    }

    if (options.plugins) {
      for (const plugin of options.plugins) {
        plugin.register(this, {});
      }
    }
  }

  registerConverter(
    converter: DocumentConverter,
    options: { priority?: number; extensions: string[]; mimeTypes: string[] },
  ): void {
    this.registry.register(converter, options);
  }

  async convert(source: string, options?: ConvertOptions): Promise<ConvertResult> {
    if (source.startsWith('data:')) {
      const { mimetype, charset, data } = parseDataUri(source);
      return this.convertBuffer(data, {
        ...options,
        streamInfo: { mimetype, charset, ...options?.streamInfo },
      });
    }

    if (source.startsWith('file:')) {
      const { path } = fileUriToPath(source);
      const readFile = this.options.nodeServices?.readFile;
      if (!readFile) {
        throw new Error('File path conversion requires nodeServices.readFile to be configured');
      }
      const buffer = await readFile(path);
      const filename = path.split('/').pop();
      return this.convertBuffer(buffer, {
        ...options,
        streamInfo: { filename, localPath: path, ...options?.streamInfo },
      });
    }

    if (source.startsWith('http:') || source.startsWith('https:')) {
      if (!options?.allowUrlFetch) {
        throw new Error(
          'URL fetching requires allowUrlFetch: true in options (SSRF protection). ' +
          'Use convertBuffer() for file uploads instead.',
        );
      }
      const response = await fetch(source, {
        ...this.options.requestInit,
        headers: {
          Accept: 'text/markdown, text/html;q=0.9, text/plain;q=0.8, */*;q=0.1',
          ...this.options.requestInit?.headers,
        },
      });
      return this.convertResponse(response, {
        ...options,
        streamInfo: { url: source, ...options?.streamInfo },
      });
    }

    // Assume local file path
    const readFile = this.options.nodeServices?.readFile;
    if (!readFile) {
      throw new Error('File path conversion requires nodeServices.readFile to be configured');
    }
    const buffer = await readFile(source);
    const filename = source.split('/').pop();
    return this.convertBuffer(buffer, {
      ...options,
      streamInfo: { filename, localPath: source, ...options?.streamInfo },
    });
  }

  async convertBuffer(buffer: Uint8Array, options?: ConvertOptions): Promise<ConvertResult> {
    let info = buildStreamInfo(options?.streamInfo ?? {});

    // If no extension or mimetype was provided, try to detect from magic bytes
    if (!info.extension && !info.mimetype) {
      try {
        const { fileTypeFromBuffer } = await import('file-type');
        const detected = await fileTypeFromBuffer(buffer);
        if (detected) {
          info = buildStreamInfo({ ...info, mimetype: detected.mime, extension: '.' + detected.ext });
        }
      } catch {
        // file-type not installed — proceed without detection
      }
    }

    const input = createConverterInputFromBuffer(buffer, this.options.maxBufferSize);
    return this.dispatch(input, info, options);
  }

  async convertStream(
    stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
    options?: ConvertOptions,
  ): Promise<ConvertResult> {
    let webStream: ReadableStream<Uint8Array>;
    if (stream instanceof ReadableStream) {
      webStream = stream;
    } else if (typeof (stream as any).pipe === 'function') {
      const nodeStream = stream as any;
      if (typeof nodeStream[Symbol.asyncIterator] === 'function') {
        const iterable = nodeStream as AsyncIterable<Uint8Array>;
        webStream = new ReadableStream<Uint8Array>({
          async start(controller) {
            for await (const chunk of iterable) {
              controller.enqueue(chunk);
            }
            controller.close();
          },
        });
      } else {
        throw new Error('Unsupported stream type. Pass a Web ReadableStream or Node stream.Readable.');
      }
    } else {
      throw new Error('Unsupported stream type');
    }

    const info = buildStreamInfo(options?.streamInfo ?? {});
    const input = createConverterInputFromStream(webStream, this.options.maxBufferSize);
    return this.dispatch(input, info, options);
  }

  async convertResponse(response: Response, options?: ConvertOptions): Promise<ConvertResult> {
    const contentType = response.headers.get('content-type') ?? '';
    const [mimeRaw, ...params] = contentType.split(';');
    const mimetype = mimeRaw.trim() || undefined;
    let charset: string | undefined;
    for (const param of params) {
      const [key, val] = param.split('=').map((s) => s.trim());
      if (key === 'charset' && val) charset = val;
    }

    const disposition = response.headers.get('content-disposition') ?? '';
    let filename: string | undefined;
    const fnMatch = disposition.match(/filename[*]?=(?:UTF-8''|"?)([^";]+)/i);
    if (fnMatch) filename = decodeURIComponent(fnMatch[1]);

    const buffer = new Uint8Array(await response.arrayBuffer());
    return this.convertBuffer(buffer, {
      ...options,
      streamInfo: {
        mimetype,
        charset,
        filename,
        url: response.url || undefined,
        ...options?.streamInfo,
      },
    });
  }

  private buildLlmCaption(): ((buffer: Uint8Array, mimeType: string) => Promise<string>) | undefined {
    if (this.options.llmCaption) return this.options.llmCaption;
    if (this.options.llmModel) {
      return async (buffer: Uint8Array, mimeType: string) => {
        const { generateText } = await import('ai');
        const result = await generateText({
          model: this.options.llmModel!,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: this.options.llmPrompt ?? 'Write a detailed caption for this image.',
                },
                {
                  type: 'image',
                  image: buffer,
                  mimeType,
                },
              ],
            },
          ],
        });
        return result.text;
      };
    }
    return undefined;
  }

  private async dispatch(
    input: ReturnType<typeof createConverterInputFromBuffer>,
    info: StreamInfo,
    options?: ConvertOptions,
  ): Promise<ConvertResult> {
    const internalOpts: InternalConvertOptions = {
      keepDataUris: options?.keepDataUris ?? false,
      maxBufferSize: this.options.maxBufferSize,
      maxUncompressedSize: this.options.maxUncompressedSize,
      llmCaption: this.buildLlmCaption(),
      nodeServices: this.options.nodeServices ?? {},
      styleMap: this.options.styleMap,
      parentConverters: this.registry.getAll(),
      convertBuffer: (buf, opts) => this.convertBuffer(buf, opts),
    };

    const guesses: StreamInfo[] = [info];
    if (info.extension || info.mimetype) {
      guesses.push({});
    }

    const failedAttempts: FailedConversionAttempt[] = [];
    let anyAccepted = false;

    for (const guess of guesses) {
      const candidates = this.registry.findConverters(guess);

      for (const reg of candidates) {
        if (!reg.converter.accepts(guess)) continue;
        anyAccepted = true;

        try {
          const result = await reg.converter.convert(input, guess, internalOpts);
          if (result === null) continue;

          return {
            markdown: normalizeOutput(result.markdown),
            title: result.title,
          };
        } catch (err) {
          failedAttempts.push({
            converter: reg.converter.constructor.name,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      }
    }

    if (failedAttempts.length > 0) {
      throw new FileConversionError(failedAttempts);
    }

    const detail = info.extension ?? info.mimetype ?? info.filename ?? 'unknown';
    throw new UnsupportedFormatError(detail);
  }

  private enableBuiltins(): void {
    // Document Intelligence (only if configured) — PRIORITY_GENERIC but checked first for configured file types
    if (this.options.docintelEndpoint) {
      try {
        const fileTypes = this.options.docintelFileTypes as any[] | undefined;
        this.registerConverter(
          new DocumentIntelligenceConverter({
            endpoint: this.options.docintelEndpoint,
            credential: this.options.docintelCredential,
            apiVersion: this.options.docintelApiVersion,
            fileTypes,
          }),
          {
            priority: PRIORITY_GENERIC,
            extensions: ['.pdf', '.docx', '.pptx', '.xlsx', '.html', '.jpg', '.jpeg', '.png', '.bmp', '.tiff'],
            mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/bmp', 'image/tiff'],
          },
        );
      } catch {
        // Azure SDK not available — skip Document Intelligence registration
      }
    }

    // Specific (priority 0) — tried first
    this.registerConverter(new IpynbConverter(), {
      priority: PRIORITY_SPECIFIC,
      extensions: ['.ipynb'],
      mimeTypes: ['application/x-ipynb+json'],
    });

    this.registerConverter(new CsvConverter(), {
      priority: PRIORITY_SPECIFIC,
      extensions: ['.csv'],
      mimeTypes: ['text/csv', 'application/csv'],
    });

    this.registerConverter(new DocxConverter(), {
      priority: PRIORITY_SPECIFIC,
      extensions: ['.docx'],
      mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    });

    this.registerConverter(new RssConverter(), {
      priority: PRIORITY_SPECIFIC,
      extensions: ['.rss', '.atom', '.xml'],
      mimeTypes: ['application/rss+xml', 'application/atom+xml', 'text/xml', 'application/xml'],
    });

    this.registerConverter(new XlsxConverter(), {
      priority: PRIORITY_SPECIFIC,
      extensions: ['.xlsx', '.xls'],
      mimeTypes: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/excel',
      ],
    });

    this.registerConverter(new PptxConverter(), {
      priority: PRIORITY_SPECIFIC,
      extensions: ['.pptx'],
      mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    });

    this.registerConverter(new EpubConverter(), {
      priority: PRIORITY_SPECIFIC,
      extensions: ['.epub'],
      mimeTypes: ['application/epub+zip', 'application/epub', 'application/x-epub+zip'],
    });

    this.registerConverter(new PdfConverter(), {
      priority: PRIORITY_SPECIFIC,
      extensions: ['.pdf'],
      mimeTypes: ['application/pdf'],
    });

    this.registerConverter(new ImageConverter(), {
      priority: PRIORITY_SPECIFIC,
      extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg'],
      mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff', 'image/webp', 'image/svg'],
    });

    this.registerConverter(new AudioConverter(), {
      priority: PRIORITY_SPECIFIC,
      extensions: ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.wma', '.mp4'],
      mimeTypes: ['audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/flac', 'audio/aac', 'video/mp4'],
    });

    this.registerConverter(new OutlookMsgConverter(), {
      priority: PRIORITY_SPECIFIC,
      extensions: ['.msg'],
      mimeTypes: ['application/vnd.ms-outlook'],
    });

    this.registerConverter(new ZipConverter(), {
      priority: PRIORITY_SPECIFIC,
      extensions: ['.zip'],
      mimeTypes: ['application/zip'],
    });

    // Generic (priority 10) — tried last
    this.registerConverter(new PlainTextConverter(), {
      priority: PRIORITY_GENERIC,
      extensions: ['.txt', '.text', '.md', '.markdown', '.json', '.jsonl'],
      mimeTypes: ['text/', 'application/json', 'application/markdown'],
    });

    // HTML converter — registered after PlainText so it takes priority for HTML content
    // (higher insertOrder = tried first within same priority level)
    this.registerConverter(new HtmlConverter(), {
      priority: PRIORITY_GENERIC,
      extensions: ['.html', '.htm'],
      mimeTypes: ['text/html', 'application/xhtml'],
    });
  }
}
