const EXT_TO_MIME = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.txt': 'text/plain',
    '.text': 'text/plain',
    '.md': 'text/markdown',
    '.markdown': 'text/markdown',
    '.json': 'application/json',
    '.jsonl': 'application/json',
    '.csv': 'text/csv',
    '.xml': 'text/xml',
    '.rss': 'application/rss+xml',
    '.atom': 'application/atom+xml',
    '.epub': 'application/epub+zip',
    '.ipynb': 'application/x-ipynb+json',
    '.msg': 'application/vnd.ms-outlook',
    '.zip': 'application/zip',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.wav': 'audio/x-wav',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.mp4': 'video/mp4',
};
const MIME_TO_EXT = {};
for (const [ext, mime] of Object.entries(EXT_TO_MIME)) {
    if (!MIME_TO_EXT[mime])
        MIME_TO_EXT[mime] = ext;
}
export function extensionToMime(ext) {
    return EXT_TO_MIME[ext.toLowerCase()];
}
export function mimeToExtension(mime) {
    return MIME_TO_EXT[mime.toLowerCase()];
}
function extractExtension(filename) {
    const dot = filename.lastIndexOf('.');
    if (dot === -1 || dot === filename.length - 1)
        return undefined;
    return filename.slice(dot).toLowerCase();
}
export function buildStreamInfo(partial) {
    let { mimetype, extension, charset, filename, localPath, url } = partial;
    if (!extension && filename) {
        extension = extractExtension(filename);
    }
    if (!extension && localPath) {
        const name = localPath.split('/').pop() ?? localPath;
        extension = extractExtension(name);
    }
    if (extension && !mimetype) {
        mimetype = extensionToMime(extension);
    }
    if (mimetype && !extension) {
        extension = mimeToExtension(mimetype);
    }
    return { mimetype, extension, charset, filename, localPath, url };
}
//# sourceMappingURL=stream-info.js.map