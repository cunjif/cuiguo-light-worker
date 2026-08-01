// src/converter-input.ts
import type { ConverterInput } from './types.js';
import { FileTooLargeError } from './errors.js';

export function createConverterInputFromBuffer(
  data: Uint8Array,
  maxBufferSize: number,
): ConverterInput {
  if (data.byteLength > maxBufferSize) {
    throw new FileTooLargeError(data.byteLength, maxBufferSize);
  }
  return {
    stream: () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      }),
    buffer: () => Promise.resolve(data),
  };
}

export function createConverterInputFromStream(
  source: ReadableStream<Uint8Array>,
  maxBufferSize: number,
): ConverterInput {
  let cached: Uint8Array | undefined;

  const ensureBuffered = async (): Promise<Uint8Array> => {
    if (cached) return cached;

    const reader = source.getReader();
    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalSize += value.byteLength;
        if (totalSize > maxBufferSize) {
          throw new FileTooLargeError(totalSize, maxBufferSize);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    if (chunks.length === 1) {
      cached = chunks[0];
    } else {
      cached = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        cached.set(chunk, offset);
        offset += chunk.byteLength;
      }
    }
    return cached;
  };

  return {
    stream: () => {
      if (cached) {
        return new ReadableStream({
          start(controller) {
            controller.enqueue(cached!);
            controller.close();
          },
        });
      }
      return new ReadableStream({
        async start(controller) {
          const buf = await ensureBuffered();
          controller.enqueue(buf);
          controller.close();
        },
      });
    },
    buffer: ensureBuffered,
  };
}
