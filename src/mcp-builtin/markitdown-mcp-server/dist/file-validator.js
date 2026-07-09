import * as fs from 'node:fs';
import * as path from 'node:path';
export function validateFilePath(filePath) {
    if (!filePath || filePath.trim() === '') {
        return { valid: false, error: 'file_path is required' };
    }
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        return { valid: false, error: 'URL input is not supported, please provide a local file path' };
    }
    const resolved = path.resolve(filePath);
    if (resolved.includes('..')) {
        const normalized = path.normalize(resolved);
        const parts = normalized.split(path.sep);
        if (parts.some((p) => p === '..')) {
            return { valid: false, error: 'Path traversal detected: file_path must not contain ".." segments that escape the target directory' };
        }
    }
    if (!fs.existsSync(resolved)) {
        return { valid: false, error: `File not found: ${filePath}` };
    }
    try {
        fs.accessSync(resolved, fs.constants.R_OK);
    }
    catch {
        return { valid: false, error: `File not readable: ${filePath}` };
    }
    return { valid: true };
}
//# sourceMappingURL=file-validator.js.map