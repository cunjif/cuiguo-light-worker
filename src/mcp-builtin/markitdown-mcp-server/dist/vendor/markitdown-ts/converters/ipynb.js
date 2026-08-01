export class IpynbConverter {
    accepts(info) {
        if (info.extension?.toLowerCase() === '.ipynb')
            return true;
        if (info.mimetype?.toLowerCase() === 'application/x-ipynb+json')
            return true;
        return false;
    }
    async convert(input, info, _opts) {
        const buffer = await input.buffer();
        const text = new TextDecoder('utf-8').decode(buffer);
        let notebook;
        try {
            notebook = JSON.parse(text);
        }
        catch {
            return null;
        }
        if (!('nbformat' in notebook))
            return null;
        const cells = [];
        let title;
        if (notebook.metadata?.title) {
            title = notebook.metadata.title;
        }
        for (const cell of notebook.cells ?? []) {
            const source = Array.isArray(cell.source)
                ? cell.source.join('')
                : (cell.source ?? '');
            if (cell.cell_type === 'markdown') {
                cells.push(source);
                if (!title) {
                    const match = source.match(/^#\s+(.+)$/m);
                    if (match)
                        title = match[1];
                }
            }
            else if (cell.cell_type === 'code') {
                cells.push('```python\n' + source + '\n```');
            }
            else if (cell.cell_type === 'raw') {
                cells.push('```\n' + source + '\n```');
            }
        }
        return { markdown: cells.join('\n\n'), title };
    }
}
//# sourceMappingURL=ipynb.js.map