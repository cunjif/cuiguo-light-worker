// src/node.ts
// Node-only helpers for @lprhodes/markitdown-ts/node subpath export.
// These create nodeServices implementations using Node.js-specific packages.

import type { ConverterInput, StreamInfo } from './types.js';

/**
 * Creates a readFile function that wraps fs/promises.readFile.
 * Use this as nodeServices.readFile for local file path support.
 */
export function createFsReader(): (path: string) => Promise<Uint8Array> {
  return async (filePath: string) => {
    const { readFile } = await import('fs/promises');
    const buffer = await readFile(filePath);
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  };
}

/**
 * Creates an exiftool reader that wraps exiftool-vendored.
 * Use this as nodeServices.exiftool for EXIF metadata extraction.
 */
export function createExiftoolReader(): (
  input: ConverterInput,
  info: StreamInfo,
) => Promise<Record<string, unknown>> {
  return async (input: ConverterInput, info: StreamInfo) => {
    let exiftool: any;
    try {
      const mod = await import('exiftool-vendored');
      exiftool = new mod.ExifTool();
    } catch {
      throw new Error(
        'exiftool-vendored is required for EXIF metadata extraction. Install with: pnpm add exiftool-vendored',
      );
    }

    try {
      // exiftool-vendored requires a file path, so we need localPath
      if (!info.localPath) {
        // Write to temp file if needed
        const { writeFile, mkdtemp, unlink } = await import('fs/promises');
        const { tmpdir } = await import('os');
        const { join } = await import('path');
        const dir = await mkdtemp(join(tmpdir(), 'markitdown-'));
        const ext = info.extension ?? '.tmp';
        const tempPath = join(dir, `temp${ext}`);
        const buffer = await input.buffer();
        await writeFile(tempPath, buffer);
        try {
          const tags = await exiftool.read(tempPath);
          return tags as Record<string, unknown>;
        } finally {
          await unlink(tempPath).catch(() => {});
          const { rmdir } = await import('fs/promises');
          await rmdir(dir).catch(() => {});
        }
      }

      const tags = await exiftool.read(info.localPath);
      return tags as Record<string, unknown>;
    } finally {
      await exiftool.end();
    }
  };
}

/**
 * Creates an audio transcriber.
 * Use this as nodeServices.transcribeAudio.
 * This is a placeholder — real implementation depends on the specific
 * transcription service (e.g., Whisper, Azure Speech).
 */
export function createAudioTranscriber(
  transcribeFn?: (filePath: string) => Promise<string>,
): (input: ConverterInput, info: StreamInfo) => Promise<string> {
  return async (input: ConverterInput, info: StreamInfo) => {
    if (!transcribeFn) {
      throw new Error(
        'Audio transcription requires a transcribeFn callback. ' +
        'Provide a function that accepts a file path and returns a transcript.',
      );
    }

    if (info.localPath) {
      return transcribeFn(info.localPath);
    }

    // Write to temp file
    const { writeFile, mkdtemp, unlink } = await import('fs/promises');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    const dir = await mkdtemp(join(tmpdir(), 'markitdown-'));
    const ext = info.extension ?? '.tmp';
    const tempPath = join(dir, `temp${ext}`);
    const buffer = await input.buffer();
    await writeFile(tempPath, buffer);
    try {
      return await transcribeFn(tempPath);
    } finally {
      await unlink(tempPath).catch(() => {});
      const { rmdir } = await import('fs/promises');
      await rmdir(dir).catch(() => {});
    }
  };
}
