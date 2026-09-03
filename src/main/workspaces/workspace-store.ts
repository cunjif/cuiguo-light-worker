import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { validatePath, ValidateResult } from './path-validator.js';

export interface WorkspaceRow {
  id: string;
  name: string;
  path: string;
  created_at: number;
  last_active: number;
  status: string;
}

export interface OperationResult {
  success: boolean;
  error?: string;
  workspace?: WorkspaceRow | null;
}

let db: InstanceType<typeof Database> | null = null;

function getDbPath(): string {
  const userDataDir = path.join(os.homedir(), '.chat-mcp');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, 'workspaces.db');
}

export function getDb(): InstanceType<typeof Database> {
  if (db) return db;

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      last_active INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE INDEX IF NOT EXISTS idx_workspaces_last_active ON workspaces(last_active DESC);
    CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
  `);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function list(): WorkspaceRow[] {
  return getDb()
    .prepare('SELECT * FROM workspaces ORDER BY last_active DESC')
    .all() as WorkspaceRow[];
}

export function getById(id: string): WorkspaceRow | null {
  const row = getDb().prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as WorkspaceRow | undefined;
  return row || null;
}

export function findByPath(p: string): WorkspaceRow | null {
  const resolved = path.resolve(p);
  const row = getDb().prepare('SELECT * FROM workspaces WHERE path = ?').get(resolved) as WorkspaceRow | undefined;
  return row || null;
}

export function create(name: string, p: string): OperationResult {
  const validation: ValidateResult = validatePath(p);
  if (!validation.ok) {
    return { success: false, error: validation.reason };
  }

  const database = getDb();
  const resolved = path.resolve(p);
  const existing = database.prepare('SELECT id FROM workspaces WHERE path = ?').get(resolved);
  if (existing) {
    return { success: false, error: 'path already exists' };
  }

  const id = randomUUID();
  const now = Date.now();

  try {
    database.prepare(
      'INSERT INTO workspaces (id, name, path, created_at, last_active, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, name, resolved, now, now, 'active');
  } catch (err: any) {
    if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { success: false, error: 'path already exists' };
    }
    return { success: false, error: String(err) };
  }

  return { success: true, workspace: getById(id) };
}

export function rename(id: string, name: string): OperationResult {
  const database = getDb();
  const result = database.prepare('UPDATE workspaces SET name = ? WHERE id = ?').run(name, id);
  if (result.changes === 0) {
    return { success: false, error: 'workspace not found' };
  }
  return { success: true, workspace: getById(id) };
}

export function setActive(id: string): OperationResult {
  const database = getDb();
  const row = getById(id);
  if (!row) {
    return { success: false, error: 'workspace not found' };
  }

  const validation: ValidateResult = validatePath(row.path);
  if (!validation.ok) {
    markInvalid(id);
    return { success: false, error: validation.reason };
  }

  const now = Date.now();
  database.prepare(
    'UPDATE workspaces SET last_active = ?, status = ? WHERE id = ?'
  ).run(now, 'active', id);

  return { success: true, workspace: getById(id) };
}

export function getActive(): WorkspaceRow | null {
  const row = getDb()
    .prepare("SELECT * FROM workspaces WHERE status = 'active' ORDER BY last_active DESC LIMIT 1")
    .get() as WorkspaceRow | undefined;
  return row || null;
}

export function markInvalid(id: string): void {
  getDb().prepare('UPDATE workspaces SET status = ? WHERE id = ?').run('invalid', id);
}

export function updatePath(id: string, newPath: string): OperationResult {
  const validation: ValidateResult = validatePath(newPath);
  if (!validation.ok) {
    return { success: false, error: validation.reason };
  }

  const database = getDb();
  const resolved = path.resolve(newPath);
  const existing = database.prepare('SELECT id FROM workspaces WHERE path = ? AND id != ?').get(resolved, id);
  if (existing) {
    return { success: false, error: 'path already used by another workspace' };
  }

  const now = Date.now();
  try {
    const result = database.prepare(
      'UPDATE workspaces SET path = ?, status = ?, last_active = ? WHERE id = ?'
    ).run(resolved, 'active', now, id);
    if (result.changes === 0) {
      return { success: false, error: 'workspace not found' };
    }
  } catch (err: any) {
    if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { success: false, error: 'path already used by another workspace' };
    }
    return { success: false, error: String(err) };
  }

  return { success: true, workspace: getById(id) };
}

export function validateAllOnStartup(): void {
  const database = getDb();
  const rows = database.prepare("SELECT id, path FROM workspaces WHERE status = 'active'").all() as { id: string; path: string }[];
  for (const row of rows) {
    const validation = validatePath(row.path);
    if (!validation.ok) {
      markInvalid(row.id);
    }
  }
}