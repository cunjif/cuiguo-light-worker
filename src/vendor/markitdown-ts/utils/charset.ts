// src/utils/charset.ts
// Map charset names that TextDecoder does not recognize to ones it does.

const CHARSET_ALIASES: Record<string, string> = {
  cp932: 'shift_jis',
  'cp-932': 'shift_jis',
  cp949: 'euc-kr',
  cp1250: 'windows-1250',
  cp1251: 'windows-1251',
  cp1252: 'windows-1252',
  cp1253: 'windows-1253',
  cp1254: 'windows-1254',
  cp1255: 'windows-1255',
  cp1256: 'windows-1256',
  cp1257: 'windows-1257',
  cp1258: 'windows-1258',
  cp874: 'windows-874',
  latin1: 'windows-1252',
  'iso-8859-1': 'windows-1252',
  ascii: 'utf-8',
};

/**
 * Normalize a charset label so TextDecoder can understand it.
 * Returns the input unchanged if no alias is known.
 */
export function normalizeCharset(charset: string): string {
  const lower = charset.toLowerCase().trim();
  return CHARSET_ALIASES[lower] ?? lower;
}

/**
 * Decode a buffer using a charset label, with automatic alias normalization.
 */
export function decodeBuffer(buffer: Uint8Array, charset: string): string {
  const normalized = normalizeCharset(charset);
  const decoder = new TextDecoder(normalized);
  return decoder.decode(buffer);
}
