import type { ConverterInput, StreamInfo } from './types.js';
/**
 * Creates a readFile function that wraps fs/promises.readFile.
 * Use this as nodeServices.readFile for local file path support.
 */
export declare function createFsReader(): (path: string) => Promise<Uint8Array>;
/**
 * Creates an exiftool reader that wraps exiftool-vendored.
 * Use this as nodeServices.exiftool for EXIF metadata extraction.
 */
export declare function createExiftoolReader(): (input: ConverterInput, info: StreamInfo) => Promise<Record<string, unknown>>;
/**
 * Creates an audio transcriber.
 * Use this as nodeServices.transcribeAudio.
 * This is a placeholder — real implementation depends on the specific
 * transcription service (e.g., Whisper, Azure Speech).
 */
export declare function createAudioTranscriber(transcribeFn?: (filePath: string) => Promise<string>): (input: ConverterInput, info: StreamInfo) => Promise<string>;
