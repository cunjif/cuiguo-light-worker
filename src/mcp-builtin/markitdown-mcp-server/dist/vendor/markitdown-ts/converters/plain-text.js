import { decodeBuffer } from '../utils/charset.js';
const ACCEPTED_MIME_PREFIXES = ['text/', 'application/json', 'application/markdown'];
const ACCEPTED_EXTENSIONS = ['.txt', '.text', '.md', '.markdown', '.json', '.jsonl'];
export class PlainTextConverter {
    accepts(info) {
        if (info.charset)
            return true;
        if (info.extension && ACCEPTED_EXTENSIONS.includes(info.extension.toLowerCase()))
            return true;
        if (info.mimetype) {
            const mime = info.mimetype.toLowerCase();
            return ACCEPTED_MIME_PREFIXES.some((p) => mime.startsWith(p));
        }
        return false;
    }
    async convert(input, info, _opts) {
        const buffer = await input.buffer();
        let text;
        if (info.charset) {
            text = decodeBuffer(buffer, info.charset);
        }
        else {
            try {
                const chardet = await import('chardet');
                const detected = chardet.detect(Buffer.from(buffer));
                text = decodeBuffer(buffer, detected ?? 'utf-8');
            }
            catch {
                text = new TextDecoder('utf-8').decode(buffer);
            }
        }
        return { markdown: text };
    }
}
//# sourceMappingURL=plain-text.js.map