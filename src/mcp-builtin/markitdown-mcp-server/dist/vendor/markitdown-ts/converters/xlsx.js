import { MissingDependencyError, UnsupportedFormatError } from '../errors.js';
const ACCEPTED_XLSX_EXTENSIONS = ['.xlsx'];
const ACCEPTED_XLSX_MIMES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const ACCEPTED_XLS_EXTENSIONS = ['.xls'];
const ACCEPTED_XLS_MIMES = [
    'application/vnd.ms-excel',
    'application/excel',
];
export class XlsxConverter {
    accepts(info) {
        const ext = (info.extension ?? '').toLowerCase();
        const mime = (info.mimetype ?? '').toLowerCase();
        if (ACCEPTED_XLSX_EXTENSIONS.includes(ext))
            return true;
        if (ACCEPTED_XLS_EXTENSIONS.includes(ext))
            return true;
        for (const m of ACCEPTED_XLSX_MIMES) {
            if (mime.startsWith(m))
                return true;
        }
        for (const m of ACCEPTED_XLS_MIMES) {
            if (mime.startsWith(m))
                return true;
        }
        return false;
    }
    async convert(input, info, _opts) {
        const ext = (info.extension ?? '').toLowerCase();
        // .xls is not supported
        if (ACCEPTED_XLS_EXTENSIONS.includes(ext)) {
            throw new UnsupportedFormatError('.xls files are not supported. Convert to .xlsx first.');
        }
        let ExcelJS;
        try {
            ExcelJS = await import('../../exceljs/excel.js');
        }
        catch {
            throw new MissingDependencyError('exceljs', 'pnpm add exceljs');
        }
        const buffer = await input.buffer();
        const workbook = new ExcelJS.default.Workbook();
        await workbook.xlsx.load(buffer);
        let mdContent = '';
        workbook.eachSheet((worksheet) => {
            mdContent += `## ${worksheet.name}\n`;
            const rows = [];
            let maxCols = 0;
            worksheet.eachRow((row) => {
                const cells = [];
                // Use cell API to detect merged cells. For non-master merged cells,
                // emit empty string to avoid duplicating the master cell's value
                // across all cells in the merge range.
                const colCount = row.cellCount;
                for (let col = 1; col <= colCount; col++) {
                    const cell = row.getCell(col);
                    if (cell.isMerged && cell.master !== cell) {
                        cells.push('');
                    }
                    else {
                        cells.push(this.formatCell(cell.value));
                    }
                }
                rows.push(cells);
            });
            if (rows.length === 0) {
                mdContent += '\n';
                return;
            }
            // Strip trailing empty cells from each row, then compute maxCols
            for (const row of rows) {
                while (row.length > 0 && row[row.length - 1] === '') {
                    row.pop();
                }
                if (row.length > maxCols)
                    maxCols = row.length;
            }
            if (maxCols === 0) {
                mdContent += '\n';
                return;
            }
            // Pad rows to same column count
            for (const row of rows) {
                while (row.length < maxCols) {
                    row.push('');
                }
            }
            // Skip entirely empty rows (all cells empty after merge dedup)
            const nonEmptyRows = rows.filter(row => row.some(cell => cell !== ''));
            if (nonEmptyRows.length === 0) {
                mdContent += '\n';
                return;
            }
            // First row is header
            const header = nonEmptyRows[0];
            mdContent += '| ' + header.join(' | ') + ' |\n';
            mdContent += '| ' + header.map(() => '---').join(' | ') + ' |\n';
            for (let i = 1; i < nonEmptyRows.length; i++) {
                mdContent += '| ' + nonEmptyRows[i].join(' | ') + ' |\n';
            }
            // Extract cell comments/notes (only from master cells)
            const comments = [];
            worksheet.eachRow((row, rowNumber) => {
                row.eachCell((cell, colNumber) => {
                    if (cell.isMerged && cell.master !== cell)
                        return;
                    if (cell.note) {
                        const cellRef = `${String.fromCharCode(64 + colNumber)}${rowNumber}`;
                        let text;
                        if (typeof cell.note === 'string') {
                            text = cell.note;
                        }
                        else {
                            text = (cell.note.texts || []).map((t) => t.text).join('');
                        }
                        if (text.trim()) {
                            comments.push({ cell: cellRef, text: text.trim() });
                        }
                    }
                });
            });
            if (comments.length > 0) {
                mdContent += '\n### Comments\n';
                for (const c of comments) {
                    mdContent += `- **${c.cell}**: ${c.text}\n`;
                }
            }
            mdContent += '\n';
        });
        return { markdown: mdContent.trimEnd() };
    }
    formatCell(value) {
        if (value == null)
            return '';
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? String(value) : value.toISOString();
        }
        if (typeof value === 'object') {
            // ExcelJS rich text: { richText: [{text: '...'}] }
            if ('richText' in value) {
                return value.richText
                    .map((rt) => rt.text ?? '')
                    .join('');
            }
            // ExcelJS formula result
            if ('result' in value) {
                return this.formatCell(value.result);
            }
            // ExcelJS hyperlink
            if ('text' in value) {
                return String(value.text);
            }
            return String(value);
        }
        return String(value);
    }
}
//# sourceMappingURL=xlsx.js.map