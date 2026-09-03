import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';

export interface ValidateResult {
  ok: boolean;
  reason?: string;
}

const SYSTEM_DIRS_WIN = [
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\ProgramData',
  'C:\\System Volume Information',
];

const SYSTEM_DIRS_UNIX = [
  '/etc', '/usr', '/var', '/root', '/bin', '/sbin', '/boot', '/dev', '/proc', '/sys',
];

function isUnder(base: string, target: string): boolean {
  const rel = path.relative(base, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function validatePath(p: string): ValidateResult {
  if (!p || typeof p !== 'string') {
    return { ok: false, reason: 'path is empty' };
  }

  let resolved: string;
  try {
    resolved = path.resolve(p);
  } catch {
    return { ok: false, reason: 'path cannot be resolved' };
  }

  if (resolved.includes('..')) {
    return { ok: false, reason: 'path contains invalid traversal' };
  }

  const platform = os.platform();
  const home = os.homedir();

  if (platform === 'win32') {
    const userProfile = process.env.USERPROFILE || home;
    const drive = resolved.substring(0, 2).toUpperCase();
    const underUserProfile = isUnder(userProfile, resolved);

    if (drive === 'C:' && !underUserProfile) {
      return { ok: false, reason: 'C: drive path must be under USERPROFILE' };
    }

    for (const sysDir of SYSTEM_DIRS_WIN) {
      if (isUnder(sysDir, resolved)) {
        return { ok: false, reason: `system directory not allowed: ${sysDir}` };
      }
    }
  } else {
    const underHome = isUnder(home, resolved);
    if (!underHome) {
      return { ok: false, reason: 'path must be under home directory' };
    }

    for (const sysDir of SYSTEM_DIRS_UNIX) {
      if (isUnder(sysDir, resolved)) {
        return { ok: false, reason: `system directory not allowed: ${sysDir}` };
      }
    }
  }

  try {
    if (!fs.existsSync(resolved)) {
      return { ok: false, reason: 'path does not exist' };
    }
  } catch {
    return { ok: false, reason: 'cannot access path' };
  }

  try {
    fs.accessSync(resolved, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    return { ok: false, reason: 'no read/write permission' };
  }

  return { ok: true };
}

export function getDefaultPath(): string {
  const platform = os.platform();
  const home = os.homedir();
  if (platform === 'win32') {
    const userProfile = process.env.USERPROFILE || home;
    return userProfile;
  }
  return home;
}