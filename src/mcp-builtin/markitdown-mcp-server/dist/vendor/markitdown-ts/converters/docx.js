import { MissingDependencyError } from '../errors.js';
import { HtmlConverter } from './html.js';
const ACCEPTED_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export class DocxConverter {
    htmlConverter = new HtmlConverter();
    accepts(info) {
        if (info.extension?.toLowerCase() === '.docx')
            return true;
        if (info.mimetype?.toLowerCase().startsWith(ACCEPTED_MIME))
            return true;
        return false;
    }
    async convert(input, info, opts) {
        let mammoth;
        let JSZip;
        try {
            mammoth = await import('../../mammoth/lib/index.js');
        }
        catch {
            throw new MissingDependencyError('mammoth', 'pnpm add mammoth');
        }
        try {
            JSZip = await import('../../jszip/lib/index.js');
        }
        catch {
            throw new MissingDependencyError('jszip', 'pnpm add jszip');
        }
        const buffer = await input.buffer();
        // Pre-process: convert OMML math to LaTeX
        const processed = await this.preProcessDocx(buffer, JSZip);
        // Convert to HTML with mammoth
        const mammothOpts = { buffer: Buffer.from(processed) };
        if (opts.styleMap)
            mammothOpts.styleMap = opts.styleMap;
        const result = await mammoth.convertToHtml(mammothOpts);
        // Convert HTML to Markdown
        const mdResult = await this.htmlConverter.convertHtml(result.value, opts.keepDataUris);
        if (!mdResult)
            return null;
        // Extract comments from word/comments.xml
        const zip = await JSZip.default.loadAsync(buffer);
        const commentsSection = await this.extractComments(zip);
        if (commentsSection) {
            mdResult.markdown = mdResult.markdown + '\n\n' + commentsSection;
        }
        return mdResult;
    }
    async extractComments(zip) {
        const commentsFile = zip.file('word/comments.xml');
        if (!commentsFile)
            return null;
        const xml = await commentsFile.async('string');
        // Parse comment elements using regex (simple and reliable for this structure)
        const commentRegex = /<w:comment\b[^>]*>([\s\S]*?)<\/w:comment>/g;
        const comments = [];
        let match;
        while ((match = commentRegex.exec(xml)) !== null) {
            const commentBlock = match[0];
            // Extract author
            const authorMatch = commentBlock.match(/w:author="([^"]*)"/);
            const author = authorMatch?.[1] ?? '';
            // Extract text content from w:t elements
            const textParts = [];
            const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
            let textMatch;
            while ((textMatch = textRegex.exec(commentBlock)) !== null) {
                textParts.push(textMatch[1]);
            }
            const text = textParts.join('').trim();
            if (text) {
                comments.push({ author, text });
            }
        }
        if (comments.length === 0)
            return null;
        let section = '### Comments\n';
        for (const c of comments) {
            if (c.author) {
                section += `- **${c.author}**: ${c.text}\n`;
            }
            else {
                section += `- ${c.text}\n`;
            }
        }
        return section.trimEnd();
    }
    async preProcessDocx(buffer, JSZip) {
        const zip = await JSZip.default.loadAsync(buffer);
        const xmlFiles = [
            'word/document.xml',
            'word/footnotes.xml',
            'word/endnotes.xml',
        ];
        let modified = false;
        for (const path of xmlFiles) {
            const file = zip.file(path);
            if (!file)
                continue;
            const xml = await file.async('string');
            if (!xml.includes('oMath'))
                continue;
            const { processOmmlInXml } = await import('../utils/docx-math/omml-to-latex.js');
            const newXml = processOmmlInXml(xml);
            if (newXml !== xml) {
                zip.file(path, newXml);
                modified = true;
            }
        }
        if (!modified)
            return buffer;
        const output = await zip.generateAsync({ type: 'uint8array' });
        return output;
    }
}
//# sourceMappingURL=docx.js.map