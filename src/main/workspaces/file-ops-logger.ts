import * as path from 'node:path';

export type FileOpKind =
  | 'createFile'
  | 'createDir'
  | 'rename'
  | 'remove'
  | 'copy'
  | 'move'
  | 'copyPathText';

interface LogExtra {
  srcPath?: string;
  destPath?: string;
  error?: string;
  failedPaths?: string[];
}

class StructuredLogger {
  static log(
    kind: FileOpKind,
    workspaceRoot: string,
    startedAt: number,
    success: boolean,
    extra?: LogExtra
  ): void {
    const elapsed = Date.now() - startedAt;
    const meta: Record<string, unknown> = {
      kind,
      workspaceRoot,
      elapsed,
      success,
    };
    if (extra?.srcPath) meta.srcPath = extra.srcPath;
    if (extra?.destPath) meta.destPath = extra.destPath;
    if (extra?.error) meta.error = extra.error;
    if (extra?.failedPaths && extra.failedPaths.length > 0) {
      meta.failedPaths = extra.failedPaths;
    }
    if (success) {
      console.log(`[file-ops] ${JSON.stringify(meta)}`);
    } else {
      console.error(`[file-ops] ${JSON.stringify(meta)}`);
    }
  }
}

export { StructuredLogger };