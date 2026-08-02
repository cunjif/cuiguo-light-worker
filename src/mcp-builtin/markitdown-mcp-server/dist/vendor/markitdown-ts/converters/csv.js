import { MissingDependencyError } from '../errors.js';
import { decodeBuffer } from '../utils/charset.js';
const ACCEPTED_MIMES = ['text/csv', 'application/csv'];
const ACCEPTED_EXTENSIONS = ['.csv'];
export class CsvConverter {
    accepts(info) {
        if (info.extension && ACCEPTED_EXTENSIONS.includes(info.extension.toLowerCase()))
            return true;
        if (info.mimetype && ACCEPTED_MIMES.includes(info.mimetype.toLowerCase()))
            return true;
        return false;
    }
    async convert(input, info, _opts) {
        let Papa;
        try {
            Papa = await import('../../papaparse/papaparse.js');
        }
        catch {
            throw new MissingDependencyError('papaparse', 'pnpm add papaparse');
        }
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
        const result = Papa.parse(text, { header: false, skipEmptyLines: true });
        const rows = result.data;
        if (rows.length === 0)
            return { markdown: '' };
        const header = rows[0];
        const numCols = header.length;
        const lines = [];
        lines.push('| ' + header.join(' | ') + ' |');
        lines.push('| ' + header.map(() => '---').join(' | ') + ' |');
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = [];
            for (let j = 0; j < numCols; j++) {
                cells.push(row[j] ?? '');
            }
            lines.push('| ' + cells.join(' | ') + ' |');
        }
        return { markdown: lines.join('\n') };
    }
}
//# sourceMappingURL=csv.js.map