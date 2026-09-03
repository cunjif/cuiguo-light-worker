import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  mtime: number;
}

const SKIP_DIRS = new Set(['node_modules', '.git']);

export function listDir(dir: string): DirEntry[] {
  const resolved = path.resolve(dir);
  const entries = fs.readdirSync(resolved, { withFileTypes: true });
  const result: DirEntry[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(resolved, entry.name);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }

    result.push({
      name: entry.name,
      path: fullPath,
      isDir: entry.isDirectory(),
      size: stat.size,
      mtime: stat.mtimeMs,
    });
  }

  result.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return result;
}

export function readFile(filePath: string): { success: boolean; content?: string; error?: string; isBinary?: boolean } {
  try {
    const resolved = path.resolve(filePath);
    const buffer = fs.readFileSync(resolved);

    const textExts = new Set([
      '.txt', '.md', '.json', '.yaml', '.yml', '.js', '.ts', '.jsx', '.tsx',
      '.html', '.css', '.scss', '.less', '.py', '.java', '.c', '.cpp', '.h',
      '.rs', '.go', '.rb', '.php', '.sh', '.bat', '.ps1', '.xml', '.svg',
      '.ini', '.cfg', '.conf', '.env', '.gitignore', '.editorconfig',
    ]);
    const ext = path.extname(resolved).toLowerCase();
    const isText = textExts.has(ext) || ext === '';

    if (!isText) {
      return { success: true, isBinary: true, content: '' };
    }

    return { success: true, content: buffer.toString('utf-8'), isBinary: false };
  } catch (err: any) {
    return { success: false, error: String(err) };
  }
}

export function writeFile(filePath: string, content: string): { success: boolean; error?: string } {
  try {
    const resolved = path.resolve(filePath);
    fs.writeFileSync(resolved, content, 'utf-8');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: String(err) };
  }
}

export function readFileBinary(filePath: string): { success: boolean; data?: Uint8Array; error?: string } {
  try {
    const resolved = path.resolve(filePath);
    const buffer = fs.readFileSync(resolved);
    return { success: true, data: new Uint8Array(buffer) };
  } catch (err: any) {
    return { success: false, error: String(err) };
  }
}

export function isPathUnder(base: string, target: string): boolean {
  const rel = path.relative(base, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}