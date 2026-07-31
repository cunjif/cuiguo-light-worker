import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const MEMORY_CHAR_LIMIT = 2200;
const USER_CHAR_LIMIT = 1375;

const THREAT_PATTERNS = [
  /ignore\s+(previous|all|above)\s+instructions?/i,
  /forget\s+(everything|all|previous)/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*/i,
  /ssh\s+-[a-zA-Z]*[pR]\s/i,
  /curl\s+.*\|\s*(ba)?sh/i,
  /eval\s*\(/i,
  /password\s*[:=]\s*\S+/i,
  /api[_-]?key\s*[:=]\s*\S+/i,
  /secret\s*[:=]\s*\S+/i,
  /token\s*[:=]\s*\S+/i,
  /[\u200b\u200c\u200d\ufeff]/,
];

let db: InstanceType<typeof Database> | null = null;

function getDbPath(): string {
  const userDataDir = path.join(os.homedir(), '.chat-mcp');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, 'self-evolution.db');
}

export function getDb(): InstanceType<typeof Database> {
  if (db) return db;

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target TEXT NOT NULL DEFAULT 'memory',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      source TEXT DEFAULT 'agent'
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
      content,
      content='memory_entries',
      content_rowid='id'
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      model TEXT,
      provider TEXT
    );

    CREATE TABLE IF NOT EXISTS session_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT,
      reasoning_content TEXT,
      tool_calls TEXT,
      tool_call_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS session_messages_fts USING fts5(
      content,
      content='session_messages',
      content_rowid='id'
    );

    CREATE TABLE IF NOT EXISTS pending_writes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      source TEXT DEFAULT 'review',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS review_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      memory_writes TEXT,
      skill_writes TEXT,
      model_used TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT DEFAULT 'completed'
    );
  `);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function scanForThreats(content: string): { safe: boolean; reason?: string } {
  for (const pattern of THREAT_PATTERNS) {
    if (pattern.test(content)) {
      return { safe: false, reason: `Content matches threat pattern: ${pattern.source}` };
    }
  }
  return { safe: true };
}

function getCharLimit(target: string): number {
  return target === 'user' ? USER_CHAR_LIMIT : MEMORY_CHAR_LIMIT;
}

function getCurrentUsage(target: string): { chars: number; limit: number; entries: { id: number; content: string }[] } {
  const database = getDb();
  const rows = database.prepare('SELECT id, content FROM memory_entries WHERE target = ? ORDER BY updated_at DESC').all(target) as { id: number; content: string }[];
  const totalChars = rows.reduce((sum, r) => sum + r.content.length, 0);
  return { chars: totalChars, limit: getCharLimit(target), entries: rows };
}

export interface MemoryEntry {
  id: number;
  target: string;
  content: string;
  created_at: string;
  updated_at: string;
  source: string;
}

export function listMemory(target?: string): MemoryEntry[] {
  const database = getDb();
  if (target) {
    return database.prepare('SELECT * FROM memory_entries WHERE target = ? ORDER BY updated_at DESC').all(target) as MemoryEntry[];
  }
  return database.prepare('SELECT * FROM memory_entries ORDER BY target, updated_at DESC').all() as MemoryEntry[];
}

export function addMemory(target: string, content: string, source: string = 'agent'): { success: boolean; error?: string; usage?: string } {
  const threatCheck = scanForThreats(content);
  if (!threatCheck.safe) {
    return { success: false, error: `Security scan blocked: ${threatCheck.reason}` };
  }

  const duplicate = getDb().prepare('SELECT id FROM memory_entries WHERE target = ? AND content = ?').get(target, content);
  if (duplicate) {
    return { success: true, error: 'no duplicate added' };
  }

  const usage = getCurrentUsage(target);
  if (usage.chars + content.length > usage.limit) {
    const entriesList = usage.entries.map(e => `[${e.id}] ${e.content.substring(0, 80)}`).join('\n');
    return {
      success: false,
      error: `Memory at ${usage.chars}/${usage.limit} chars. Adding this entry (${content.length} chars) would exceed the limit. Consolidate now: use 'replace' to merge overlapping entries into shorter ones or 'remove' stale entries, then retry. Current entries:\n${entriesList}`,
      usage: `${usage.chars}/${usage.limit}`
    };
  }

  getDb().prepare('INSERT INTO memory_entries (target, content, source) VALUES (?, ?, ?)').run(target, content, source);
  const newUsage = getCurrentUsage(target);
  return { success: true, usage: `${newUsage.chars}/${newUsage.limit}` };
}

export function replaceMemory(target: string, oldText: string, content: string, source: string = 'agent'): { success: boolean; error?: string; usage?: string } {
  const threatCheck = scanForThreats(content);
  if (!threatCheck.safe) {
    return { success: false, error: `Security scan blocked: ${threatCheck.reason}` };
  }

  const rows = getDb().prepare('SELECT id, content FROM memory_entries WHERE target = ? AND content LIKE ?').all(target, `%${oldText}%`) as { id: number; content: string }[];

  if (rows.length === 0) {
    return { success: false, error: `No entry found matching "${oldText}" in ${target}` };
  }
  if (rows.length > 1) {
    return { success: false, error: `Multiple entries match "${oldText}". Be more specific.` };
  }

  const oldEntry = rows[0];
  const usage = getCurrentUsage(target);
  const newChars = usage.chars - oldEntry.content.length + content.length;
  if (newChars > usage.limit) {
    return {
      success: false,
      error: `Replacement would exceed limit: ${newChars}/${usage.limit} chars. Shorten the new content or remove other entries first.`,
      usage: `${usage.chars}/${usage.limit}`
    };
  }

  getDb().prepare('UPDATE memory_entries SET content = ?, source = ?, updated_at = datetime(\'now\') WHERE id = ?').run(content, source, oldEntry.id);
  const updatedUsage = getCurrentUsage(target);
  return { success: true, usage: `${updatedUsage.chars}/${updatedUsage.limit}` };
}

export function removeMemory(target: string, oldText: string): { success: boolean; error?: string } {
  const rows = getDb().prepare('SELECT id, content FROM memory_entries WHERE target = ? AND content LIKE ?').all(target, `%${oldText}%`) as { id: number; content: string }[];

  if (rows.length === 0) {
    return { success: false, error: `No entry found matching "${oldText}" in ${target}` };
  }
  if (rows.length > 1) {
    return { success: false, error: `Multiple entries match "${oldText}". Be more specific.` };
  }

  getDb().prepare('DELETE FROM memory_entries WHERE id = ?').run(rows[0].id);
  return { success: true };
}

export function getMemoryForPrompt(): { memoryText: string; userText: string } {
  const memEntries = listMemory('memory');
  const userEntries = listMemory('user');

  const memChars = memEntries.reduce((s, e) => s + e.content.length, 0);
  const userChars = userEntries.reduce((s, e) => s + e.content.length, 0);

  let memoryText = '';
  if (memEntries.length > 0) {
    const pct = Math.round((memChars / MEMORY_CHAR_LIMIT) * 100);
    memoryText = `══════════════════════════════════════════════\nMEMORY (你的个人笔记) [${pct}% — ${memChars}/${MEMORY_CHAR_LIMIT} chars]\n══════════════════════════════════════════════\n${memEntries.map(e => e.content).join('§')}`;
  }

  let userText = '';
  if (userEntries.length > 0) {
    const pct = Math.round((userChars / USER_CHAR_LIMIT) * 100);
    userText = `══════════════════════════════════════════════\nUSER PROFILE (用户画像) [${pct}% — ${userChars}/${USER_CHAR_LIMIT} chars]\n══════════════════════════════════════════════\n${userEntries.map(e => e.content).join('§')}`;
  }

  return { memoryText, userText };
}

export function searchMemory(query: string, limit: number = 5): { id: number; target: string; content: string; rank: number }[] {
  const database = getDb();
  try {
    return database.prepare(`
      SELECT m.id, m.target, m.content, f.rank
      FROM memory_fts f
      JOIN memory_entries m ON m.id = f.rowid
      WHERE memory_fts MATCH ?
      ORDER BY f.rank
      LIMIT ?
    `).all(query, limit) as { id: number; target: string; content: string; rank: number }[];
  } catch {
    return [];
  }
}

export interface SessionInfo {
  id: string;
  title: string;
  created_at: string;
  model: string;
  provider: string;
}

export interface SessionMessage {
  id: number;
  session_id: string;
  role: string;
  content: string;
  reasoning_content: string | null;
  tool_calls: string | null;
  tool_call_id: string | null;
  created_at: string;
}

export function saveSession(sessionId: string, messages: { role: string; content?: string; reasoning_content?: string; tool_calls?: any[]; tool_call_id?: string }[], model?: string, provider?: string): void {
  const database = getDb();

  const existing = database.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
  if (existing) {
    database.prepare('UPDATE sessions SET updated_at = datetime(\'now\'), model = ?, provider = ? WHERE id = ?').run(model || null, provider || null, sessionId);
    database.prepare('DELETE FROM session_messages WHERE session_id = ?').run(sessionId);
  } else {
    const title = messages.find(m => m.role === 'user')?.content?.substring(0, 100) || sessionId;
    database.prepare('INSERT INTO sessions (id, title, created_at, updated_at, model, provider) VALUES (?, ?, datetime(\'now\'), datetime(\'now\'), ?, ?)').run(sessionId, title, model || null, provider || null);
  }

  const insertMsg = database.prepare('INSERT INTO session_messages (session_id, role, content, reasoning_content, tool_calls, tool_call_id) VALUES (?, ?, ?, ?, ?, ?)');
  for (const msg of messages) {
    insertMsg.run(
      sessionId,
      msg.role,
      msg.content || null,
      msg.reasoning_content || null,
      msg.tool_calls ? JSON.stringify(msg.tool_calls) : null,
      msg.tool_call_id || null
    );
  }
}

export function searchSessions(query: string, limit: number = 5): { session_id: string; role: string; content: string; rank: number }[] {
  const database = getDb();
  try {
    return database.prepare(`
      SELECT sm.session_id, sm.role, sm.content, f.rank
      FROM session_messages_fts f
      JOIN session_messages sm ON sm.id = f.rowid
      WHERE session_messages_fts MATCH ?
      ORDER BY f.rank
      LIMIT ?
    `).all(query, limit) as { session_id: string; role: string; content: string; rank: number }[];
  } catch {
    return [];
  }
}

export function listSessions(limit: number = 20): SessionInfo[] {
  return getDb().prepare('SELECT id, title, created_at, model, provider FROM sessions ORDER BY updated_at DESC LIMIT ?').all(limit) as SessionInfo[];
}

export function handleMemoryToolCall(params: { action: string; target: string; content?: string; old_text?: string }): { success: boolean; error?: string; usage?: string; entries?: any[] } {
  const { action, target, content, old_text } = params;

  if (!['memory', 'user'].includes(target)) {
    return { success: false, error: `Invalid target: ${target}. Must be 'memory' or 'user'.` };
  }

  switch (action) {
    case 'add':
      if (!content) return { success: false, error: 'content is required for add action' };
      return addMemory(target, content);

    case 'replace':
      if (!old_text || !content) return { success: false, error: 'old_text and content are required for replace action' };
      return replaceMemory(target, old_text, content);

    case 'remove':
      if (!old_text) return { success: false, error: 'old_text is required for remove action' };
      return removeMemory(target, old_text);

    case 'list':
      return { success: true, entries: listMemory(target) };

    default:
      return { success: false, error: `Unknown action: ${action}. Use add, replace, remove, or list.` };
  }
}

export function handleSessionSearchToolCall(params: { query: string; limit?: number }): { results: { session_id: string; role: string; content: string; rank: number }[] } {
  const results = searchSessions(params.query, params.limit || 5);
  return { results };
}

const AGENT_SKILLS_DIR = path.join(os.homedir(), '.chat-mcp', 'skills', 'agent-created');

function ensureAgentSkillsDir(): string {
  if (!fs.existsSync(AGENT_SKILLS_DIR)) {
    fs.mkdirSync(AGENT_SKILLS_DIR, { recursive: true });
  }
  return AGENT_SKILLS_DIR;
}

export interface AgentSkillManifest {
  name: string;
  version: string;
  displayName: { zh: string; en: string };
  description: { zh: string; en: string };
  icon: string;
  category: string;
  tags: string[];
  author: string;
  triggers: { type: string; value: string; priority: number }[];
  systemPrompt: string;
  userPromptTemplate?: string;
}

export function createAgentSkill(manifest: AgentSkillManifest): { success: boolean; error?: string; name?: string } {
  const threatCheck = scanForThreats(manifest.systemPrompt);
  if (!threatCheck.safe) {
    return { success: false, error: `Security scan blocked: ${threatCheck.reason}` };
  }

  if (!manifest.name || !manifest.systemPrompt) {
    return { success: false, error: 'name and systemPrompt are required' };
  }

  const safeName = manifest.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const dir = ensureAgentSkillsDir();
  const filePath = path.join(dir, `${safeName}.json`);

  const fullManifest: AgentSkillManifest = {
    name: safeName,
    version: manifest.version || '1.0.0',
    displayName: manifest.displayName || { zh: safeName, en: safeName },
    description: manifest.description || { zh: `Agent 创建的技能: ${safeName}`, en: `Agent-created skill: ${safeName}` },
    icon: manifest.icon || 'mdi-robot',
    category: manifest.category || 'custom',
    tags: manifest.tags || [safeName],
    author: 'agent',
    triggers: manifest.triggers || [],
    systemPrompt: manifest.systemPrompt,
    userPromptTemplate: manifest.userPromptTemplate,
  };

  fs.writeFileSync(filePath, JSON.stringify(fullManifest, null, 2), 'utf8');
  return { success: true, name: safeName };
}

export function patchAgentSkill(name: string, patches: Partial<AgentSkillManifest>): { success: boolean; error?: string } {
  const dir = ensureAgentSkillsDir();
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const filePath = path.join(dir, `${safeName}.json`);

  if (!fs.existsSync(filePath)) {
    return { success: false, error: `Skill "${name}" not found` };
  }

  try {
    const existing: AgentSkillManifest = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (patches.systemPrompt) {
      const threatCheck = scanForThreats(patches.systemPrompt);
      if (!threatCheck.safe) {
        return { success: false, error: `Security scan blocked: ${threatCheck.reason}` };
      }
    }

    const updated = { ...existing, ...patches, name: existing.name, author: existing.author };
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf8');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export function deleteAgentSkill(name: string): { success: boolean; error?: string } {
  const dir = ensureAgentSkillsDir();
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const filePath = path.join(dir, `${safeName}.json`);

  if (!fs.existsSync(filePath)) {
    return { success: false, error: `Skill "${name}" not found` };
  }

  fs.unlinkSync(filePath);
  return { success: true };
}

export function listAgentSkills(): AgentSkillManifest[] {
  const dir = ensureAgentSkillsDir();
  const skills: AgentSkillManifest[] = [];

  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const manifest: AgentSkillManifest = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        skills.push(manifest);
      } catch {}
    }
  } catch {}

  return skills;
}

export function handleSkillManageToolCall(params: { action: string; name?: string; manifest?: AgentSkillManifest; patches?: Partial<AgentSkillManifest> }): { success: boolean; error?: string; name?: string; skills?: AgentSkillManifest[] } {
  switch (params.action) {
    case 'create':
      if (!params.manifest) return { success: false, error: 'manifest is required for create action' };
      return createAgentSkill(params.manifest);

    case 'patch':
      if (!params.name || !params.patches) return { success: false, error: 'name and patches are required for patch action' };
      return patchAgentSkill(params.name, params.patches);

    case 'delete':
      if (!params.name) return { success: false, error: 'name is required for delete action' };
      return deleteAgentSkill(params.name);

    case 'list':
      return { success: true, skills: listAgentSkills() };

    default:
      return { success: false, error: `Unknown action: ${params.action}. Use create, patch, delete, or list.` };
  }
}

export interface PendingWrite {
  id: number;
  type: string;
  action: string;
  payload: string;
  source: string;
  created_at: string;
  status: string;
}

export function addPendingWrite(type: string, action: string, payload: object, source: string = 'review'): number {
  const database = getDb();
  const stmt = database.prepare('INSERT INTO pending_writes (type, action, payload, source, status) VALUES (?, ?, ?, ?, ?)');
  const result = stmt.run(type, action, JSON.stringify(payload), source, 'pending');
  return Number(result.lastInsertRowid);
}

export function listPendingWrites(status?: string): PendingWrite[] {
  const database = getDb();
  if (status) {
    return database.prepare('SELECT * FROM pending_writes WHERE status = ? ORDER BY created_at DESC').all(status) as PendingWrite[];
  }
  return database.prepare('SELECT * FROM pending_writes ORDER BY created_at DESC').all() as PendingWrite[];
}

export function approvePendingWrite(id: number): { success: boolean; error?: string } {
  const database = getDb();
  const row = database.prepare('SELECT * FROM pending_writes WHERE id = ? AND status = ?').get(id, 'pending') as PendingWrite | undefined;
  if (!row) return { success: false, error: `Pending write ${id} not found or not pending` };

  try {
    const payload = JSON.parse(row.payload);

    if (row.type === 'memory') {
      const result = handleMemoryToolCall(payload);
      if (!result.success) return { success: false, error: result.error };
    } else if (row.type === 'skill') {
      const result = handleSkillManageToolCall(payload);
      if (!result.success) return { success: false, error: result.error };
    }

    database.prepare('UPDATE pending_writes SET status = ? WHERE id = ?').run('approved', id);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export function rejectPendingWrite(id: number): { success: boolean; error?: string } {
  const database = getDb();
  const row = database.prepare('SELECT * FROM pending_writes WHERE id = ? AND status = ?').get(id, 'pending') as PendingWrite | undefined;
  if (!row) return { success: false, error: `Pending write ${id} not found or not pending` };

  database.prepare('UPDATE pending_writes SET status = ? WHERE id = ?').run('rejected', id);
  return { success: true };
}