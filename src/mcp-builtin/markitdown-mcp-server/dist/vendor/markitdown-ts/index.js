// src/index.ts
import { MarkItDown } from './markitdown.js';
export { MarkItDown };
export var FileType;
(function (FileType) {
    FileType["PDF"] = "pdf";
    FileType["DOCX"] = "docx";
    FileType["XLSX"] = "xlsx";
    FileType["XLS"] = "xls";
    FileType["PPTX"] = "pptx";
    FileType["HTML"] = "html";
    FileType["CSV"] = "csv";
    FileType["EPUB"] = "epub";
    FileType["RSS"] = "rss";
    FileType["ATOM"] = "atom";
    FileType["XML"] = "xml";
    FileType["IPYNB"] = "ipynb";
    FileType["JSON"] = "json";
    FileType["JSONL"] = "jsonl";
    FileType["TXT"] = "txt";
    FileType["MD"] = "md";
    FileType["MSG"] = "msg";
    FileType["ZIP"] = "zip";
    FileType["JPG"] = "jpg";
    FileType["JPEG"] = "jpeg";
    FileType["PNG"] = "png";
    FileType["GIF"] = "gif";
    FileType["BMP"] = "bmp";
    FileType["TIFF"] = "tiff";
    FileType["WEBP"] = "webp";
    FileType["SVG"] = "svg";
    FileType["MP3"] = "mp3";
    FileType["WAV"] = "wav";
    FileType["M4A"] = "m4a";
    FileType["OGG"] = "ogg";
    FileType["FLAC"] = "flac";
    FileType["AAC"] = "aac";
    FileType["WMA"] = "wma";
    FileType["MP4"] = "mp4";
})(FileType || (FileType = {}));
function isAxiosLike(source) {
    return (typeof source === 'object' &&
        source !== null &&
        'data' in source &&
        'headers' in source &&
        !(source instanceof Response));
}
function toBuffer(data) {
    if (data instanceof Uint8Array)
        return data;
    if (data instanceof ArrayBuffer)
        return new Uint8Array(data);
    if (typeof data === 'string')
        return new TextEncoder().encode(data);
    throw new Error('Axios response data must be an ArrayBuffer or Buffer. ' +
        'Set responseType: "arraybuffer" in your Axios request for binary files.');
}
function extractAxiosInfo(res) {
    const buffer = toBuffer(res.data);
    const contentType = String(res.headers['content-type'] ?? '');
    const [mimeRaw, ...params] = contentType.split(';');
    const mimetype = mimeRaw.trim() || undefined;
    let charset;
    for (const param of params) {
        const [key, val] = param.split('=').map((s) => s.trim());
        if (key === 'charset' && val)
            charset = val;
    }
    const disposition = String(res.headers['content-disposition'] ?? '');
    let filename;
    const fnMatch = disposition.match(/filename[*]?=(?:UTF-8''|"?)([^";]+)/i);
    if (fnMatch)
        filename = decodeURIComponent(fnMatch[1]);
    const url = res.config?.url;
    return { buffer, mimetype, charset, filename, url };
}
/**
 * Convert a file to Markdown in one call.
 *
 * Accepts a file path, URL, data URI, Uint8Array/Buffer, fetch Response,
 * or Axios response.
 */
export async function markitdown(source, options) {
    const { type, keepDataUris, allowUrlFetch, ...mdOptions } = options ?? {};
    const typeInfo = type ? { extension: '.' + type } : {};
    const md = new MarkItDown(mdOptions);
    if (typeof source === 'string') {
        return md.convert(source, { keepDataUris, allowUrlFetch, streamInfo: typeInfo });
    }
    if (source instanceof Response) {
        return md.convertResponse(source, { keepDataUris, allowUrlFetch, streamInfo: typeInfo });
    }
    if (isAxiosLike(source)) {
        const ax = extractAxiosInfo(source);
        return md.convertBuffer(ax.buffer, {
            keepDataUris,
            allowUrlFetch,
            streamInfo: {
                mimetype: ax.mimetype,
                charset: ax.charset,
                filename: ax.filename,
                url: ax.url,
                ...typeInfo,
            },
        });
    }
    // Uint8Array / Buffer
    return md.convertBuffer(source, { keepDataUris, allowUrlFetch, streamInfo: typeInfo });
}
export { MarkItDownError, MissingDependencyError, UnsupportedFormatError, FileConversionError, FileTooLargeError, } from './errors.js';
export { PRIORITY_SPECIFIC, PRIORITY_GENERIC } from './constants.js';
//# sourceMappingURL=index.js.map