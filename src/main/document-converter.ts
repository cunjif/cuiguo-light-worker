// document-converter.ts
// 包装 @lprhodes/markitdown-ts，为渲染进程提供统一的"附件转 Markdown"服务。
// 转换失败时返回降级结果，调用方应继续走渲染进程内的浏览器解析路径。

import { MarkItDown } from '@lprhodes/markitdown-ts';

export interface ConvertRequest {
    /** 文件名（用于推断扩展名） */
    fileName: string;
    /** 文件二进制内容 */
    data: number[] | Uint8Array;
    /** 显式指定的 mime 类型（可选） */
    mimeType?: string;
}

export interface ConvertResult {
    /** 是否转换成功 */
    success: boolean;
    /** 转换得到的 Markdown 内容（失败时为 null） */
    markdown: string | null;
    /** 文档标题（如果 markitdown-ts 能解析出来） */
    title: string | null;
    /** 错误信息（成功时为空） */
    error: string;
    /** 处理耗时（毫秒） */
    durationMs: number;
    /** 使用的转换器名称（仅用于日志） */
    engine: string;
}

let markItDownInstance: MarkItDown | null = null;
let markItDownFailed: string | null = null;

/**
 * 懒加载 MarkItDown 实例。
 * @lprhodes/markitdown-ts 的转换器按需懒加载，但部分格式（PDF/DOCX/...）依赖
 * 作为可选 peer dep 安装的底层库；缺失时它会抛 MissingDependencyError，
 * 此处把任何初始化异常都记下来，调用方走渲染进程内的浏览器降级路径。
 */
function getMarkItDown(): MarkItDown {
    if (markItDownInstance) return markItDownInstance;
    if (markItDownFailed) {
        throw new Error(markItDownFailed);
    }
    try {
        markItDownInstance = new MarkItDown();
        return markItDownInstance;
    } catch (e: any) {
        markItDownFailed = `@lprhodes/markitdown-ts unavailable: ${e?.message || e}`;
        throw new Error(markItDownFailed);
    }
}

function inferExtension(fileName: string, mimeType?: string): string {
    if (fileName) {
        const idx = fileName.lastIndexOf('.');
        if (idx > 0 && idx < fileName.length - 1) {
            return fileName.substring(idx + 1).toLowerCase();
        }
    }
    if (mimeType) {
        const map: Record<string, string> = {
            'application/pdf': 'pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
            'application/vnd.ms-powerpoint': 'ppt',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'application/vnd.ms-excel': 'xls',
            'text/markdown': 'md',
            'text/plain': 'txt',
            'text/csv': 'csv',
            'text/html': 'html'
        };
        if (map[mimeType]) return map[mimeType];
    }
    return '';
}

/**
 * 将附件转为 Markdown。
 * 始终通过 Promise.resolve 包装：调用方在 IPC 侧可以放心 await。
 */
export async function convertDocumentToMarkdown(req: ConvertRequest): Promise<ConvertResult> {
    const started = Date.now();
    const fileName = req?.fileName || 'document';
    const ext = inferExtension(fileName, req?.mimeType);
    if (!ext) {
        return {
            success: false,
            markdown: null,
            title: null,
            error: 'No file extension could be inferred; main-process conversion skipped.',
            durationMs: Date.now() - started,
            engine: 'markitdown-ts'
        };
    }
    let buffer: Uint8Array;
    try {
        buffer = req.data instanceof Uint8Array ? req.data : new Uint8Array(req.data);
    } catch (e: any) {
        return {
            success: false,
            markdown: null,
            title: null,
            error: `Invalid file data: ${e?.message || e}`,
            durationMs: Date.now() - started,
            engine: 'markitdown-ts'
        };
    }
    let markitdown: MarkItDown;
    try {
        markitdown = getMarkItDown();
    } catch (e: any) {
        return {
            success: false,
            markdown: null,
            title: null,
            error: e?.message || 'markitdown-ts init failed',
            durationMs: Date.now() - started,
            engine: 'markitdown-ts'
        };
    }
    try {
        const result = await markitdown.convertBuffer(buffer, { streamInfo: { extension: '.' + ext } });
        const markdown = result?.markdown || '';
        const trimmed = markdown.trim();
        if (!trimmed) {
            return {
                success: false,
                markdown: null,
                title: result?.title || null,
                error: 'markitdown-ts returned empty content (PDF may be scanned or encoding unsupported).',
                durationMs: Date.now() - started,
                engine: 'markitdown-ts'
            };
        }
        return {
            success: true,
            markdown,
            title: result?.title || null,
            error: '',
            durationMs: Date.now() - started,
            engine: 'markitdown-ts'
        };
    } catch (e: any) {
        return {
            success: false,
            markdown: null,
            title: null,
            error: `markitdown-ts conversion failed: ${e?.message || e}`,
            durationMs: Date.now() - started,
            engine: 'markitdown-ts'
        };
    }
}
