import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { isPathUnder } from './file-service.js';
import { StructuredLogger, FileOpKind } from './file-ops-logger.js';
import { fileOpsQueue } from './file-ops-queue.js';

export interface OpResult {
  success: boolean;
  error?: string;
  affectedPaths?: string[];
}

export interface BatchOpResult extends OpResult {
  failedPaths?: string[];
}

export type ConflictStrategy = 'overwrite' | 'skip' | 'rename';

export const ILLEGAL_NAME_CHARS = new Set([
  '/', '\\', ':', '*', '?', '"', '<', '>', '|',
]);

export const RESERVED_DIR_NAMES = new Set(['node_modules', '.git']);

const SKIP_DIRS = new Set(['node_modules', '.git']);

function mapFsError(err: NodeJS.ErrnoException | unknown): string {
  const e = err as NodeJS.ErrnoException;
  if (!e) return String(err);
  switch (e.code) {
    case 'EEXIST': return '名称已存在';
    case 'EACCES': return '权限不足';
    case 'EPERM': return '权限不足';
    case 'ENOENT': return '路径不存在';
    case 'ENOSPC': return '磁盘空间不足';
    case 'EBUSY': return '文件被占用';
    case 'EXDEV': return '跨设备链接';
    case 'ENOTEMPTY': return '目录非空';
    default: return e.message || String(err);
  }
}

function isIllegalName(name: string): boolean {
  if (!name || name.length === 0) return true;
  for (const ch of name) {
    if (ILLEGAL_NAME_CHARS.has(ch)) return true;
  }
  return false;
}

function validateName(
  name: string,
  isDir: boolean,
  allowReserved: boolean
): { ok: boolean; reason?: string } {
  if (!name || name.trim().length === 0) {
    return { ok: false, reason: '名称为空' };
  }
  if (isIllegalName(name)) {
    return { ok: false, reason: '名称包含非法字符' };
  }
  if (isDir && !allowReserved && RESERVED_DIR_NAMES.has(name)) {
    return { ok: false, reason: '该名称被保留' };
  }
  return { ok: true };
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function findNonConflictingName(destDir: string, name: string): Promise<string> {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  return (async () => {
    for (let i = 1; i < 10000; i++) {
      const candidate = `${base} (${i})${ext}`;
      const candidatePath = path.join(destDir, candidate);
      if (!(await pathExists(candidatePath))) {
        return candidate;
      }
    }
    return `${base} (copy)${ext}`;
  })();
}

async function copyRecursive(
  src: string,
  dest: string,
  conflict: ConflictStrategy,
  failedPaths: string[]
): Promise<boolean> {
  try {
    const stat = await fs.stat(src);
    if (stat.isDirectory()) {
      await fs.mkdir(dest, { recursive: true });
      const entries = await fs.readdir(src, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
        const srcChild = path.join(src, entry.name);
        const destChild = path.join(dest, entry.name);
        await copyRecursive(srcChild, destChild, conflict, failedPaths);
      }
      return true;
    } else {
      await fs.copyFile(src, dest);
      return true;
    }
  } catch (err) {
    failedPaths.push(src);
    return false;
  }
}

async function removeRecursive(
  target: string,
  failedPaths: string[]
): Promise<boolean> {
  try {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(target, { withFileTypes: true });
      for (const entry of entries) {
        const child = path.join(target, entry.name);
        await removeRecursive(child, failedPaths);
      }
      try {
        await fs.rmdir(target);
      } catch (err) {
        failedPaths.push(target);
        return false;
      }
      return true;
    } else {
      await fs.unlink(target);
      return true;
    }
  } catch (err) {
    failedPaths.push(target);
    return false;
  }
}

export async function createFile(
  workspaceRoot: string,
  parentDir: string,
  name: string
): Promise<OpResult> {
  const startedAt = Date.now();
  const kind: FileOpKind = 'createFile';

  if (!isPathUnder(workspaceRoot, parentDir)) {
    StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: 'out of workspace bounds', srcPath: parentDir });
    return { success: false, error: 'out of workspace bounds' };
  }
  const nameCheck = validateName(name, false, true);
  if (!nameCheck.ok) {
    StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: nameCheck.reason, srcPath: parentDir });
    return { success: false, error: nameCheck.reason };
  }

  return fileOpsQueue.enqueue(workspaceRoot, async () => {
    try {
      const newPath = path.join(parentDir, name);
      if (await pathExists(newPath)) {
        StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: '名称已存在', destPath: newPath });
        return { success: false, error: '名称已存在' };
      }
      await fs.writeFile(newPath, '', 'utf-8');
      StructuredLogger.log(kind, workspaceRoot, startedAt, true, { destPath: newPath });
      return { success: true, affectedPaths: [newPath] };
    } catch (err) {
      const reason = mapFsError(err);
      StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: reason, srcPath: parentDir });
      return { success: false, error: reason };
    }
  });
}

export async function createDir(
  workspaceRoot: string,
  parentDir: string,
  name: string
): Promise<OpResult> {
  const startedAt = Date.now();
  const kind: FileOpKind = 'createDir';

  if (!isPathUnder(workspaceRoot, parentDir)) {
    StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: 'out of workspace bounds', srcPath: parentDir });
    return { success: false, error: 'out of workspace bounds' };
  }
  const nameCheck = validateName(name, true, false);
  if (!nameCheck.ok) {
    StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: nameCheck.reason, srcPath: parentDir });
    return { success: false, error: nameCheck.reason };
  }

  return fileOpsQueue.enqueue(workspaceRoot, async () => {
    try {
      const newPath = path.join(parentDir, name);
      if (await pathExists(newPath)) {
        StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: '名称已存在', destPath: newPath });
        return { success: false, error: '名称已存在' };
      }
      await fs.mkdir(newPath);
      StructuredLogger.log(kind, workspaceRoot, startedAt, true, { destPath: newPath });
      return { success: true, affectedPaths: [newPath] };
    } catch (err) {
      const reason = mapFsError(err);
      StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: reason, srcPath: parentDir });
      return { success: false, error: reason };
    }
  });
}

export async function rename(
  workspaceRoot: string,
  oldPath: string,
  newName: string
): Promise<OpResult> {
  const startedAt = Date.now();
  const kind: FileOpKind = 'rename';

  if (!isPathUnder(workspaceRoot, oldPath)) {
    StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: 'out of workspace bounds', srcPath: oldPath });
    return { success: false, error: 'out of workspace bounds' };
  }
  const isDir = fsSync.existsSync(oldPath) && fsSync.statSync(oldPath).isDirectory();
  const nameCheck = validateName(newName, isDir, false);
  if (!nameCheck.ok) {
    StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: nameCheck.reason, srcPath: oldPath });
    return { success: false, error: nameCheck.reason };
  }

  return fileOpsQueue.enqueue(workspaceRoot, async () => {
    try {
      if (!(await pathExists(oldPath))) {
        StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: '源路径不存在', srcPath: oldPath });
        return { success: false, error: '源路径不存在' };
      }
      const dir = path.dirname(oldPath);
      const newPath = path.join(dir, newName);
      if (oldPath === newPath) {
        StructuredLogger.log(kind, workspaceRoot, startedAt, true, { srcPath: oldPath, destPath: newPath });
        return { success: true, affectedPaths: [oldPath, newPath] };
      }
      if (await pathExists(newPath)) {
        StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: '名称已存在', destPath: newPath });
        return { success: false, error: '名称已存在' };
      }
      await fs.rename(oldPath, newPath);
      StructuredLogger.log(kind, workspaceRoot, startedAt, true, { srcPath: oldPath, destPath: newPath });
      return { success: true, affectedPaths: [oldPath, newPath] };
    } catch (err) {
      const reason = mapFsError(err);
      StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: reason, srcPath: oldPath });
      return { success: false, error: reason };
    }
  });
}

export async function remove(
  workspaceRoot: string,
  targetPath: string
): Promise<BatchOpResult> {
  const startedAt = Date.now();
  const kind: FileOpKind = 'remove';

  if (!isPathUnder(workspaceRoot, targetPath)) {
    StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: 'out of workspace bounds', srcPath: targetPath });
    return { success: false, error: 'out of workspace bounds' };
  }
  if (path.resolve(targetPath) === path.resolve(workspaceRoot)) {
    StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: '不能删除工作目录根', srcPath: targetPath });
    return { success: false, error: '不能删除工作目录根' };
  }

  return fileOpsQueue.enqueue(workspaceRoot, async () => {
    try {
      if (!(await pathExists(targetPath))) {
        StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: '路径不存在', srcPath: targetPath });
        return { success: false, error: '路径不存在' };
      }
      const failedPaths: string[] = [];
      const ok = await removeRecursive(targetPath, failedPaths);
      if (ok) {
        StructuredLogger.log(kind, workspaceRoot, startedAt, true, { srcPath: targetPath });
        return { success: true, affectedPaths: [targetPath] };
      } else {
        StructuredLogger.log(kind, workspaceRoot, startedAt, false, { srcPath: targetPath, failedPaths });
        return { success: false, error: '部分项删除失败', failedPaths };
      }
    } catch (err) {
      const reason = mapFsError(err);
      StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: reason, srcPath: targetPath });
      return { success: false, error: reason };
    }
  });
}

export async function copy(
  workspaceRoot: string,
  srcPath: string,
  destDir: string,
  conflict: ConflictStrategy
): Promise<OpResult> {
  const startedAt = Date.now();
  const kind: FileOpKind = 'copy';

  if (!isPathUnder(workspaceRoot, srcPath) || !isPathUnder(workspaceRoot, destDir)) {
    StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: 'out of workspace bounds', srcPath, destPath: destDir });
    return { success: false, error: 'out of workspace bounds' };
  }
  if (isPathUnder(srcPath, destDir)) {
    StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: '不能复制到自身或子目录内', srcPath, destPath: destDir });
    return { success: false, error: '不能复制到自身或子目录内' };
  }

  return fileOpsQueue.enqueue(workspaceRoot, async () => {
    try {
      if (!(await pathExists(srcPath))) {
        StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: '源路径不存在', srcPath });
        return { success: false, error: '源路径不存在' };
      }
      const name = path.basename(srcPath);
      let destName = name;
      const destPath = path.join(destDir, destName);
      if (await pathExists(destPath)) {
        if (conflict === 'skip') {
          StructuredLogger.log(kind, workspaceRoot, startedAt, true, { srcPath, destPath });
          return { success: true, affectedPaths: [destPath] };
        } else if (conflict === 'rename') {
          destName = await findNonConflictingName(destDir, name);
        }
      }
      const finalDest = path.join(destDir, destName);
      if (conflict === 'overwrite' && (await pathExists(finalDest))) {
        await removeRecursive(finalDest, []);
      }
      const failedPaths: string[] = [];
      const ok = await copyRecursive(srcPath, finalDest, conflict, failedPaths);
      if (ok) {
        StructuredLogger.log(kind, workspaceRoot, startedAt, true, { srcPath, destPath: finalDest });
        return { success: true, affectedPaths: [srcPath, finalDest] };
      } else {
        StructuredLogger.log(kind, workspaceRoot, startedAt, false, { srcPath, destPath: finalDest, failedPaths });
        return { success: false, error: '部分项复制失败', affectedPaths: [finalDest] };
      }
    } catch (err) {
      const reason = mapFsError(err);
      StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: reason, srcPath, destPath: destDir });
      return { success: false, error: reason };
    }
  });
}

export async function move(
  workspaceRoot: string,
  srcPath: string,
  destDir: string,
  conflict: ConflictStrategy
): Promise<OpResult> {
  const startedAt = Date.now();
  const kind: FileOpKind = 'move';

  if (!isPathUnder(workspaceRoot, srcPath) || !isPathUnder(workspaceRoot, destDir)) {
    StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: 'out of workspace bounds', srcPath, destPath: destDir });
    return { success: false, error: 'out of workspace bounds' };
  }
  if (isPathUnder(srcPath, destDir)) {
    StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: '不能将文件夹移动到自身内部', srcPath, destPath: destDir });
    return { success: false, error: '不能将文件夹移动到自身内部' };
  }

  return fileOpsQueue.enqueue(workspaceRoot, async () => {
    try {
      if (!(await pathExists(srcPath))) {
        StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: '源路径不存在', srcPath });
        return { success: false, error: '源路径不存在' };
      }
      const name = path.basename(srcPath);
      let destName = name;
      const destPath = path.join(destDir, destName);
      if (await pathExists(destPath)) {
        if (conflict === 'skip') {
          StructuredLogger.log(kind, workspaceRoot, startedAt, true, { srcPath, destPath });
          return { success: true, affectedPaths: [srcPath, destPath] };
        } else if (conflict === 'rename') {
          destName = await findNonConflictingName(destDir, name);
        }
      }
      const finalDest = path.join(destDir, destName);
      if (conflict === 'overwrite' && (await pathExists(finalDest))) {
        await removeRecursive(finalDest, []);
      }
      try {
        await fs.rename(srcPath, finalDest);
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code === 'EXDEV') {
          const failedPaths: string[] = [];
          const ok = await copyRecursive(srcPath, finalDest, conflict, failedPaths);
          if (!ok) {
            StructuredLogger.log(kind, workspaceRoot, startedAt, false, { srcPath, destPath: finalDest, failedPaths });
            return { success: false, error: '跨设备移动失败' };
          }
          await removeRecursive(srcPath, []);
        } else {
          throw err;
        }
      }
      StructuredLogger.log(kind, workspaceRoot, startedAt, true, { srcPath, destPath: finalDest });
      return { success: true, affectedPaths: [srcPath, finalDest] };
    } catch (err) {
      const reason = mapFsError(err);
      StructuredLogger.log(kind, workspaceRoot, startedAt, false, { error: reason, srcPath, destPath: destDir });
      return { success: false, error: reason };
    }
  });
}