import type { ConverterInput } from './types.js';
export declare function createConverterInputFromBuffer(data: Uint8Array, maxBufferSize: number): ConverterInput;
export declare function createConverterInputFromStream(source: ReadableStream<Uint8Array>, maxBufferSize: number): ConverterInput;
