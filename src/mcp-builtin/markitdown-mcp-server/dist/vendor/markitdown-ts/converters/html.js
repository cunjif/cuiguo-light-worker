import { MissingDependencyError } from '../errors.js';
const ACCEPTED_MIMES = ['text/html', 'application/xhtml'];
const ACCEPTED_EXTENSIONS = ['.html', '.htm'];
export class HtmlConverter {
    accepts(info) {
        if (info.extension && ACCEPTED_EXTENSIONS.includes(info.extension.toLowerCase()))
            return true;
        if (info.mimetype) {
            const mime = info.mimetype.toLowerCase();
            return ACCEPTED_MIMES.some((m) => mime.startsWith(m));
        }
        return false;
    }
    async convert(input, info, opts) {
        const buffer = await input.buffer();
        const charset = info.charset ?? 'utf-8';
        const html = new TextDecoder(charset).decode(buffer);
        return this.convertHtml(html, opts.keepDataUris);
    }
    async convertHtml(html, keepDataUris = false) {
        let cheerio;
        let TurndownService;
        try {
            cheerio = await import('cheerio');
        }
        catch {
            throw new MissingDependencyError('cheerio', 'pnpm add cheerio');
        }
        try {
            TurndownService = (await import('../../turndown/lib/turndown.cjs.js'));
        }
        catch {
            throw new MissingDependencyError('turndown', 'pnpm add turndown');
        }
        const $ = cheerio.load(html);
        // Remove dangerous elements (XSS prevention)
        $('script, style, iframe, object, embed, applet, form').remove();
        // XSS: Strip all event handler attributes
        $('*').each((_, el) => {
            const attribs = $(el).attr();
            for (const attr of Object.keys(attribs ?? {})) {
                if (attr.startsWith('on'))
                    $(el).removeAttr(attr);
            }
        });
        // Extract title
        const title = $('title').first().text().trim() || undefined;
        // Get body content (fallback to entire document)
        const body = $('body').html() ?? $.html();
        // Configure Turndown with custom rules
        const td = new TurndownService.default({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
        });
        // Custom rule: Remove javascript links
        td.addRule('noJsLinks', {
            filter: (node) => {
                if (node.nodeName !== 'A')
                    return false;
                const href = node.getAttribute('href') ?? '';
                if (href.startsWith('javascript:'))
                    return true;
                if (href.includes(':') && !href.match(/^(https?|file):/i))
                    return true;
                return false;
            },
            replacement: (_content, node) => node.textContent ?? '',
        });
        // Custom rule: Truncate data URIs in images
        td.addRule('truncateDataUris', {
            filter: 'img',
            replacement: (_content, node) => {
                const alt = node.getAttribute('alt') ?? '';
                let src = node.getAttribute('src') ?? '';
                if (!keepDataUris && src.startsWith('data:')) {
                    const commaIdx = src.indexOf(',');
                    if (commaIdx !== -1) {
                        src = src.slice(0, commaIdx).replace(';base64', ';base64...');
                        if (!src.endsWith('...'))
                            src += '...';
                    }
                }
                return `![${alt}](${src})`;
            },
        });
        // Custom rule: Checkboxes
        td.addRule('checkboxes', {
            filter: (node) => node.nodeName === 'INPUT' && node.getAttribute('type') === 'checkbox',
            replacement: (_content, node) => node.getAttribute('checked') !== null ? '[x] ' : '[ ] ',
        });
        const markdown = td.turndown(body);
        return { markdown, title };
    }
}
//# sourceMappingURL=html.js.map