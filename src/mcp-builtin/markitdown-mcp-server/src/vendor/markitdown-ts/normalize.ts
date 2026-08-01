// src/normalize.ts

const TRAILING_WHITESPACE = /[ \t]+$/gm;
const EXCESSIVE_NEWLINES = /\n{3,}/g;

export function normalizeOutput(text: string): string {
  return text
    .replace(TRAILING_WHITESPACE, '')
    .replace(EXCESSIVE_NEWLINES, '\n\n')
    .trim();
}
