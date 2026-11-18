/**
 * ==========================================================================
 * markdown-render - Markdown 富渲染管道
 * ==========================================================================
 * 统一渲染管道，支持 mermaid/PlantUML/图片/表格等富内容渲染。
 * 供文件预览和聊天消息复用。
 *
 * 模块：
 *   - MermaidRenderer: mermaid 代码块 → SVG
 *   - PlantUmlRenderer: PlantUML 代码块 → 图片（远程渲染）
 *   - SafeImageRenderer: 图片路径安全过滤
 *   - MarkdownRenderPipeline: 统一渲染入口
 */

let mermaidInitialized = false;

function initMermaid() {
    if (mermaidInitialized || typeof mermaid === 'undefined') return;
    try {
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: 'default',
        });
        mermaidInitialized = true;
    } catch (e) {
        console.error('Mermaid init failed:', e);
    }
}

const MermaidRenderer = {
    async render(code) {
        if (typeof mermaid === 'undefined') {
            return { success: false, error: 'Mermaid library not loaded' };
        }
        initMermaid();
        try {
            const id = 'mermaid-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const { svg } = await mermaid.render(id, code);
            return { success: true, svg };
        } catch (e) {
            return { success: false, error: e.message || 'Mermaid render error' };
        }
    },
};

const PlantUmlRenderer = {
    serverUrl: 'https://www.plantuml.com/plantuml/svg/',

    async render(code) {
        try {
            const encoded = this.encodePlantUml(code);
            const url = this.serverUrl + encoded;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) {
                return { success: false, error: 'Server error: ' + response.status };
            }
            const svg = await response.text();
            if (svg.includes('<svg')) {
                return { success: true, svg };
            }
            return { success: false, error: 'Invalid response' };
        } catch (e) {
            if (e.name === 'AbortError') {
                return { success: false, error: 'timeout' };
            }
            return { success: false, error: 'Service unavailable' };
        }
    },

    encodePlantUml(text) {
        const data = unescape(encodeURIComponent(text));
        const compressed = this.deflateRaw(data);
        return this.encode64(compressed);
    },

    deflateRaw(data) {
        if (typeof pako !== 'undefined' && pako.deflateRaw) {
            return pako.deflateRaw(data);
        }
        const bytes = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
        return bytes;
    },

    encode64(bytes) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let result = '';
        for (let i = 0; i < bytes.length; i += 3) {
            const b1 = bytes[i] || 0;
            const b2 = bytes[i + 1] || 0;
            const b3 = bytes[i + 2] || 0;
            result += chars[b1 >> 2];
            result += chars[((b1 & 0x3) << 4) | (b2 >> 4)];
            result += chars[((b2 & 0xF) << 2) | (b3 >> 6)];
            result += chars[b3 & 0x3F];
        }
        return result;
    },
};

const SafeImageRenderer = {
    render(src, workspacePath) {
        if (!src) return { success: false, error: 'No image source' };
        if (/^https?:\/\//.test(src) || /^data:/.test(src)) {
            return { success: true, src };
        }
        if (/^\.\.?\//.test(src) || /^[^\/]/.test(src)) {
            if (workspacePath) {
                const resolved = workspacePath.replace(/\\/g, '/') + '/' + src.replace(/^\.\.?\//, '');
                return { success: true, src: 'file://' + resolved };
            }
            return { success: true, src };
        }
        return { success: false, error: 'Path outside workspace' };
    },
};

function sanitizeHtml(html) {
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
        .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
        .replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
}

const MarkdownRenderPipeline = {
    async render(markdownText, options = {}) {
        if (!markdownText) return '';
        const workspacePath = options.workspacePath || '';
        const lines = markdownText.split('\n');
        const result = [];
        const chartPlaceholders = [];
        let inMermaid = false;
        let inPlantUml = false;
        let codeBuffer = [];
        let mermaidCount = 0;
        let plantUmlCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (/^```mermaid\s*$/.test(line.trim())) {
                inMermaid = true;
                codeBuffer = [];
                continue;
            }
            if (/^```plantuml\s*$/.test(line.trim()) || /^```puml\s*$/.test(line.trim())) {
                inPlantUml = true;
                codeBuffer = [];
                continue;
            }
            if ((inMermaid || inPlantUml) && /^```\s*$/.test(line.trim())) {
                const code = codeBuffer.join('\n');
                const placeholderId = 'chart-placeholder-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                if (inMermaid) {
                    chartPlaceholders.push({ id: placeholderId, type: 'mermaid', code });
                    result.push('<div id="' + placeholderId + '" class="chart-placeholder"><pre>```mermaid\n' + code + '\n```</pre></div>');
                    mermaidCount++;
                }
                if (inPlantUml) {
                    chartPlaceholders.push({ id: placeholderId, type: 'plantuml', code });
                    result.push('<div id="' + placeholderId + '" class="chart-placeholder"><pre>```plantuml\n' + code + '\n```</pre></div>');
                    plantUmlCount++;
                }
                inMermaid = false;
                inPlantUml = false;
                codeBuffer = [];
                continue;
            }
            if (inMermaid || inPlantUml) {
                codeBuffer.push(line);
                continue;
            }
            result.push(line);
        }

        if (inMermaid || inPlantUml) {
            const code = codeBuffer.join('\n');
            result.push('<pre><code>' + code + '</code></pre>');
        }

        let mdText = result.join('\n');
        mdText = mdText.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
            const r = SafeImageRenderer.render(src, workspacePath);
            if (r.success) {
                return '<img src="' + r.src + '" alt="' + alt + '" style="max-width:100%;" />';
            }
            return '<div class="render-error">Image: ' + r.error + ' (' + src + ')</div>';
        });

        const baseHtml = sanitizeHtml(mdText);

        if (chartPlaceholders.length > 0) {
            MarkdownRenderPipeline._renderChartsAsync(chartPlaceholders);
        }

        return baseHtml;
    },

    async _renderChartsAsync(placeholders) {
        for (const ph of placeholders) {
            try {
                let r;
                if (ph.type === 'mermaid') {
                    r = await MermaidRenderer.render(ph.code);
                } else {
                    r = await PlantUmlRenderer.render(ph.code);
                }
                const el = document.getElementById(ph.id);
                if (el) {
                    if (r.success) {
                        el.innerHTML = r.svg;
                        el.className = ph.type === 'mermaid' ? 'mermaid-rendered' : 'plantuml-rendered';
                    } else {
                        el.innerHTML = '<pre>```' + ph.type + '\n' + ph.code + '\n```\n' + r.error + '</pre>';
                        el.className = 'render-error';
                    }
                }
            } catch (e) {
                const el = document.getElementById(ph.id);
                if (el) {
                    el.className = 'render-error';
                }
            }
        }
    },
};

if (typeof window !== 'undefined') {
    window.MermaidRenderer = MermaidRenderer;
    window.PlantUmlRenderer = PlantUmlRenderer;
    window.SafeImageRenderer = SafeImageRenderer;
    window.MarkdownRenderPipeline = MarkdownRenderPipeline;
}