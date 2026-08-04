import { McpServer } from './vendor/mcp-sdk/dist/esm/server/mcp.js';
import { z } from './vendor/mcp-sdk/node_modules/zod/v4/index.js';
import { validateFilePath } from './file-validator.js';
import { convertFile, inferFileType } from './converter.js';
import * as logger from './logger.js';

const FILE_TYPE_ENUM = [
  'pdf', 'docx', 'xlsx', 'xls', 'pptx', 'html', 'csv', 'epub', 'rss', 'atom',
  'xml', 'ipynb', 'json', 'jsonl', 'txt', 'md', 'msg', 'zip', 'jpg', 'jpeg',
  'png', 'gif', 'bmp', 'tiff', 'webp', 'svg', 'mp3', 'wav', 'm4a', 'ogg',
  'flac', 'aac', 'wma', 'mp4',
] as const;

export function registerConvertTool(server: McpServer): void {
  server.tool(
    'convert_to_markdown',
    'Convert a local file to Markdown text. Supports PDF, DOCX, XLSX, PPTX, HTML, CSV, EPUB, images, audio and more.',
    {
      file_path: z.string().describe('Absolute path to the local file to convert'),
      type: z.enum(FILE_TYPE_ENUM).optional().describe('File format hint. Auto-detected from extension when omitted.'),
    },
    async (params) => {
      const started = Date.now();
      const filePath = params.file_path;
      const typeHint = params.type;

      const validation = validateFilePath(filePath);
      if (!validation.valid) {
        logger.warn('File validation failed', { filePath, error: validation.error, durationMs: Date.now() - started });
        return {
          content: [{ type: 'text' as const, text: validation.error! }],
          isError: true,
        };
      }

      let fileType: string;
      try {
        fileType = inferFileType(filePath, typeHint);
      } catch (e: any) {
        logger.warn('Format inference failed', { filePath, error: e.message, durationMs: Date.now() - started });
        return {
          content: [{ type: 'text' as const, text: e.message }],
          isError: true,
        };
      }

      const result = await convertFile(filePath, typeHint);
      const durationMs = Date.now() - started;

      if (!result.success) {
        logger.warn('Conversion failed', { filePath, format: fileType, durationMs, error: result.error });
        return {
          content: [{ type: 'text' as const, text: result.error! }],
          isError: true,
        };
      }

      logger.info('Conversion succeeded', { filePath, format: fileType, durationMs });
      return {
        content: [{ type: 'text' as const, text: result.markdown! }],
      };
    },
  );
}