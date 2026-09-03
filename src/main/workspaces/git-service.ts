import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';

const execAsync = promisify(execFile);

export interface GitCheckResult {
  installed: boolean;
  hasRepo: boolean;
}

export interface GitStatusEntry {
  file: string;
  staged: boolean;
  modified: boolean;
  status: string;
}

export async function checkGitInstalled(): Promise<boolean> {
  try {
    await execAsync('git', ['--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export function hasGitRepo(dir: string): boolean {
  return fs.existsSync(path.join(dir, '.git'));
}

export async function gitCheck(dir: string): Promise<GitCheckResult> {
  const installed = await checkGitInstalled();
  const hasRepo = installed ? hasGitRepo(dir) : false;
  return { installed, hasRepo };
}

export async function gitStatus(dir: string): Promise<GitStatusEntry[]> {
  const { stdout } = await execAsync('git', ['status', '--porcelain=v1'], { cwd: dir });
  const entries: GitStatusEntry[] = [];
  const lines = stdout.split('\n').filter(l => l.trim());

  for (const line of lines) {
    const status = line.substring(0, 2);
    const file = line.substring(3).trim();
    entries.push({
      file,
      staged: status[0] !== ' ' && status[0] !== '?',
      modified: status[1] !== ' ' || status[0] === '?',
      status: status.trim(),
    });
  }

  return entries;
}

export async function gitStage(dir: string, files: string[]): Promise<void> {
  await execAsync('git', ['add', ...files], { cwd: dir });
}

export async function gitUnstage(dir: string, files: string[]): Promise<void> {
  await execAsync('git', ['reset', 'HEAD', ...files], { cwd: dir });
}

export async function gitCommit(dir: string, message: string): Promise<string> {
  const { stdout } = await execAsync('git', ['commit', '-m', message], { cwd: dir });
  return stdout;
}

export async function gitDiff(dir: string, file?: string): Promise<string> {
  const args = ['diff', '--patch'];
  if (file) args.push(file);
  const { stdout } = await execAsync('git', args, { cwd: dir });
  return stdout;
}