import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';

const execAsync = promisify(execFile);

// ==========================================================================
// TimeoutPolicy - 命令超时分组策略
// ==========================================================================
// 速读类命令 10 秒；写入/网络类命令 60 秒
export const TimeoutPolicy = {
  status: 10_000,
  diff: 10_000,
  log: 10_000,
  show: 10_000,
  stage: 60_000,
  unstage: 60_000,
  commit: 60_000,
  pull: 60_000,
  push: 60_000,
} as const;

export type GitCommandKind = keyof typeof TimeoutPolicy;

// ==========================================================================
// StructuredLogger - 结构化操作日志
// ==========================================================================
class StructuredLogger {
  static log(kind: GitCommandKind, dir: string, startedAt: number, success: boolean, extra?: { stdout?: string; stderr?: string; error?: string }) {
    const elapsed = Date.now() - startedAt;
    const meta = {
      kind,
      dir,
      elapsed,
      success,
      ...(extra?.error ? { error: extra.error } : {}),
    };
    if (success) {
      console.log(`[git-service] ${JSON.stringify(meta)}`);
    } else {
      // 失败时完整透出原始 stdout/stderr，便于定位根因（DFX 4.4.1/4.4.2）
      console.error(`[git-service] ${JSON.stringify({
        ...meta,
        stdout: extra?.stdout,
        stderr: extra?.stderr,
      })}`);
    }
  }
}

// ==========================================================================
// ConcurrencyQueue - 按工作目录维度的串行执行队列
// ==========================================================================
// 同一目录命令串行执行，不同目录并行；异常 catch 后链继续，对调用方透明
class ConcurrencyQueue {
  private chains = new Map<string, Promise<unknown>>();

  async enqueue<T>(dir: string, task: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(dir) ?? Promise.resolve();
    const next = prev.then(() => task(), () => task());
    // 链尾异常吞掉，避免 reject 阻塞后续命令；真实错误由 task 自行抛出给调用方
    this.chains.set(dir, next.then(() => undefined, () => undefined));
    return next;
  }
}

const concurrencyQueue = new ConcurrencyQueue();

// ==========================================================================
// 领域类型定义
// ==========================================================================
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

export interface GitDiffResult {
  patch: string;
  binary: boolean;
}

export interface GitLogEntry {
  hash: string;
  author: string;
  time: string;
  message: string;
}

export interface GitShowFile {
  file: string;
  status: string;
}

export interface GitShowResult {
  files: GitShowFile[];
  patch: string;
}

export interface GitPullResult {
  success: boolean;
  output: string;
  conflicted: boolean;
}

export interface GitPushResult {
  success: boolean;
  output: string;
  rejected: boolean;
  noUpstream: boolean;
}

// ==========================================================================
// 内部执行封装 - 统一注入超时 + 结构化日志 + 串行队列
// ==========================================================================
async function runGit(
  dir: string,
  kind: GitCommandKind,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  const startedAt = Date.now();
  const timeout = TimeoutPolicy[kind];

  return concurrencyQueue.enqueue(dir, async () => {
    try {
      const result = await execAsync('git', args, { cwd: dir, timeout });
      StructuredLogger.log(kind, dir, startedAt, true);
      return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
    } catch (err: any) {
      const stdout = err?.stdout ?? '';
      const stderr = err?.stderr ?? '';
      StructuredLogger.log(kind, dir, startedAt, false, {
        stdout,
        stderr,
        error: String(err?.message ?? err),
      });
      // 重新抛出，附带 stdout/stderr 便于上层判定冲突/拒绝等业务语义
      const wrapped = new Error(err?.message ?? String(err));
      (wrapped as any).stdout = stdout;
      (wrapped as any).stderr = stderr;
      throw wrapped;
    }
  });
}

// ==========================================================================
// 对外接口实现
// ==========================================================================
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
  const { stdout } = await runGit(dir, 'status', ['status', '--porcelain=v1']);
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
  await runGit(dir, 'stage', ['add', ...files]);
}

export async function gitUnstage(dir: string, files: string[]): Promise<void> {
  await runGit(dir, 'unstage', ['reset', 'HEAD', ...files]);
}

export async function gitCommit(dir: string, message: string): Promise<string> {
  const { stdout } = await runGit(dir, 'commit', ['commit', '-m', message]);
  return stdout;
}

/**
 * 查询 diff 差异
 * @param dir 工作目录
 * @param file 指定文件路径（可选）
 * @param staged true 时查询暂存区 vs HEAD（附加 --cached）；否则查询工作区 vs 暂存区
 */
export async function gitDiff(dir: string, file?: string, staged?: boolean): Promise<GitDiffResult> {
  const args = ['diff', '--patch'];
  if (staged) args.push('--cached');
  if (file) args.push(file);
  const { stdout } = await runGit(dir, 'diff', args);
  // 通过输出包含 "Binary files" 关键字判定二进制
  const binary = /Binary files/.test(stdout);
  return { patch: stdout, binary };
}

/**
 * 提交历史分页查询
 * @param dir 工作目录
 * @param opts.skip 跳过前 N 条（默认 0）
 * @param opts.limit 返回条数（默认 50）
 */
export async function gitLog(
  dir: string,
  opts?: { skip?: number; limit?: number },
): Promise<GitLogEntry[]> {
  const skip = Math.max(0, opts?.skip ?? 0);
  const limit = Math.max(1, opts?.limit ?? 50);
  const args = [
    'log',
    `--skip=${skip}`,
    `-n=${limit}`,
    "--pretty=format:%H|%an|%aI|%s",
  ];
  const { stdout } = await runGit(dir, 'log', args);
  const entries: GitLogEntry[] = [];
  const lines = stdout.split('\n').filter(l => l.trim());
  for (const line of lines) {
    // 仅按前 3 个 | 分隔，message 中可能含 |
    const firstSep = line.indexOf('|');
    const secondSep = line.indexOf('|', firstSep + 1);
    const thirdSep = line.indexOf('|', secondSep + 1);
    if (firstSep < 0 || secondSep < 0 || thirdSep < 0) continue;
    entries.push({
      hash: line.substring(0, firstSep),
      author: line.substring(firstSep + 1, secondSep),
      time: line.substring(secondSep + 1, thirdSep),
      message: line.substring(thirdSep + 1),
    });
  }
  return entries;
}

/**
 * 单次提交详情查询
 * @param dir 工作目录
 * @param hash 提交哈希
 */
export async function gitShow(dir: string, hash: string): Promise<GitShowResult> {
  // --stat 输出文件变更概览；--patch 输出 diff；pretty=format:'' 抑制提交元数据行
  const { stdout } = await runGit(dir, 'show', [
    'show',
    '--stat',
    '--patch',
    "--pretty=format:",
    hash,
  ]);
  return parseGitShowOutput(stdout);
}

/**
 * 解析 git show 输出为文件列表 + diff patch
 * 输出结构：前段为 --stat 文件列表（" file | N ++--" 形式），后段为 diff patch
 */
function parseGitShowOutput(stdout: string): GitShowResult {
  const files: GitShowFile[] = [];
  const lines = stdout.split('\n');
  // diff 起始行以 "diff --git" 开头
  let diffStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('diff --git')) {
      diffStart = i;
      break;
    }
  }
  const statEnd = diffStart < 0 ? lines.length : diffStart;
  // 解析 --stat 部分：形如 " src/foo.ts | 12 ++--"
  for (let i = 0; i < statEnd; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const m = line.match(/^\s+([^\s|].*?)\s+\|\s+\d+/);
    if (m) {
      const file = m[1].trim();
      // 通过同行后续 ++/-- 推断状态不可靠，统一标记为 M（修改）
      files.push({ file, status: 'M' });
    }
  }
  // patch 部分从 diffStart 开始；若没有 diff 则空
  const patch = diffStart < 0 ? '' : lines.slice(diffStart).join('\n');
  return { files, patch };
}

/**
 * 拉取远程更新
 */
export async function gitPull(dir: string): Promise<GitPullResult> {
  try {
    const { stdout } = await runGit(dir, 'pull', ['pull']);
    const conflicted = /CONFLICT/i.test(stdout);
    return { success: !conflicted, output: stdout, conflicted };
  } catch (err: any) {
    const output = (err?.stdout ?? '') + (err?.stderr ?? '');
    const conflicted = /CONFLICT/i.test(output);
    return { success: false, output, conflicted };
  }
}

/**
 * 推送本地提交到远程
 */
export async function gitPush(dir: string): Promise<GitPushResult> {
  try {
    const { stdout } = await runGit(dir, 'push', ['push']);
    const output = stdout;
    const noUpstream = /no upstream|No upstream/i.test(output);
    const rejected = /rejected|non-fast-forward/i.test(output);
    return { success: !noUpstream && !rejected, output, rejected, noUpstream };
  } catch (err: any) {
    const output = (err?.stdout ?? '') + (err?.stderr ?? '');
    const noUpstream = /no upstream|No upstream|has no upstream/i.test(output);
    const rejected = /rejected|non-fast-forward/i.test(output);
    return { success: false, output, rejected, noUpstream };
  }
}
