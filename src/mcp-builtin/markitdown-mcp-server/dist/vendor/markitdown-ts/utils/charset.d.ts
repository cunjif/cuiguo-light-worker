/**
 * Normalize a charset label so TextDecoder can understand it.
 * Returns the input unchanged if no alias is known.
 */
export declare function normalizeCharset(charset: string): string;
/**
 * Decode a buffer using a charset label, with automatic alias normalization.
 */
export declare function decodeBuffer(buffer: Uint8Array, charset: string): string;
