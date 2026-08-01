// src/converters/audio.ts
import type {
  DocumentConverter,
  StreamInfo,
  ConverterInput,
  InternalConvertOptions,
  ConvertResult,
} from '../types.js';

const ACCEPTED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.wma', '.mp4'];
const ACCEPTED_MIME_PREFIXES = ['audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/flac', 'audio/aac', 'video/mp4'];

const METADATA_FIELDS = [
  'Title',
  'Artist',
  'Author',
  'Band',
  'Album',
  'Genre',
  'Track',
  'DateTimeOriginal',
  'CreateDate',
  'NumChannels',
  'SampleRate',
  'AvgBytesPerSec',
  'BitsPerSample',
];

export class AudioConverter implements DocumentConverter {
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
    const filename = info.filename ?? info.localPath ?? 'audio';
    let mdContent = `# Audio: ${filename}\n`;

    // Extract metadata if exiftool is available
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

    // Transcribe audio if transcribeAudio is available
    if (opts.nodeServices?.transcribeAudio) {
      try {
        const transcript = await opts.nodeServices.transcribeAudio(input, info);
        if (transcript) {
          mdContent += '\n## Transcript\n\n' + transcript.trim() + '\n';
        }
      } catch {
        // Graceful degradation: transcription failed, continue without transcript
      }
    }

    return { markdown: mdContent.trim() };
  }
}
