// src/normalize.ts
const TRAILING_WHITESPACE = /[ \t]+$/gm;
const EXCESSIVE_NEWLINES = /\n{3,}/g;
export function normalizeOutput(text) {
    return text
        .replace(TRAILING_WHITESPACE, '')
        .replace(EXCESSIVE_NEWLINES, '\n\n')
        .trim();
}
//# sourceMappingURL=normalize.js.map