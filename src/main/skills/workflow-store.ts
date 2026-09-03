import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { randomUUID } from 'crypto';

export type WorkflowStepType = 'skill' | 'branch' | 'loop' | 'parallel' | 'workflow';

export interface WorkflowStepBase {
  id: string;
  type: WorkflowStepType;
}

export interface SkillStep extends WorkflowStepBase {
  type: 'skill';
  ref: string;
  inputMapping?: Record<string, string>;
}

export interface BranchCase {
  case: string;
  children: WorkflowStep[];
}

export interface BranchStep extends WorkflowStepBase {
  type: 'branch';
  condition: string;
  branches: BranchCase[];
  default?: WorkflowStep[];
}

export interface LoopStep extends WorkflowStepBase {
  type: 'loop';
  iterations: number;
  children: WorkflowStep[];
}

export interface ParallelStep extends WorkflowStepBase {
  type: 'parallel';
  children: WorkflowStep[];
}

export interface WorkflowRefStep extends WorkflowStepBase {
  type: 'workflow';
  ref: string;
}

export type WorkflowStep = SkillStep | BranchStep | LoopStep | ParallelStep | WorkflowRefStep;

export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface WorkflowVersion {
  id: number;
  workflowId: string;
  version: number;
  snapshot: WorkflowStep[];
  createdAt: string;
}

interface WorkflowRow {
  id: string;
  name: string;
  steps: string;
  created_at: string;
  updated_at: string;
  version: number;
}

interface WorkflowVersionRow {
  id: number;
  workflow_id: string;
  version: number;
  snapshot: string;
  created_at: string;
}

let db: InstanceType<typeof Database> | null = null;

function getDbPath(): string {
  const userDataDir = path.join(os.homedir(), '.chat-mcp');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, 'workflows.db');
}

export function getDb(): InstanceType<typeof Database> {
  if (db) return db;

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      steps TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS workflow_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_workflow_versions_wf ON workflow_versions(workflow_id);
  `);

  return db;
}

export function closeWorkflowDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function rowToWorkflow(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    name: row.name,
    steps: JSON.parse(row.steps) as WorkflowStep[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

function rowToVersion(row: WorkflowVersionRow): WorkflowVersion {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    version: row.version,
    snapshot: JSON.parse(row.snapshot) as WorkflowStep[],
    createdAt: row.created_at,
  };
}

export function listWorkflows(): Workflow[] {
  const rows = getDb().prepare('SELECT * FROM workflows ORDER BY updated_at DESC').all() as WorkflowRow[];
  return rows.map(rowToWorkflow);
}

export function getWorkflow(id: string): Workflow | null {
  const row = getDb().prepare('SELECT * FROM workflows WHERE id = ?').get(id) as WorkflowRow | undefined;
  return row ? rowToWorkflow(row) : null;
}

export interface OperationResult {
  success: boolean;
  error?: string;
  workflow?: Workflow | null;
}

export function createWorkflow(name: string, steps: WorkflowStep[]): OperationResult {
  const database = getDb();
  const existing = database.prepare('SELECT id FROM workflows WHERE name = ?').get(name);
  if (existing) {
    return { success: false, error: 'name exists' };
  }

  const id = randomUUID();
  const stepsJson = JSON.stringify(steps);

  const tx = database.transaction(() => {
    database.prepare(
      'INSERT INTO workflows (id, name, steps, version) VALUES (?, ?, ?, 1)'
    ).run(id, name, stepsJson);
    database.prepare(
      'INSERT INTO workflow_versions (workflow_id, version, snapshot) VALUES (?, 1, ?)'
    ).run(id, stepsJson);
  });
  tx();

  return { success: true, workflow: getWorkflow(id) };
}

export function renameWorkflow(id: string, name: string): OperationResult {
  const database = getDb();
  const existing = database.prepare('SELECT id FROM workflows WHERE name = ? AND id != ?').get(name, id);
  if (existing) {
    return { success: false, error: 'name exists' };
  }

  const result = database.prepare(
    'UPDATE workflows SET name = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).run(name, id);

  if (result.changes === 0) {
    return { success: false, error: 'workflow not found' };
  }

  return { success: true, workflow: getWorkflow(id) };
}

export function saveWorkflow(id: string, steps: WorkflowStep[]): OperationResult {
  const database = getDb();
  const current = database.prepare('SELECT version FROM workflows WHERE id = ?').get(id) as { version: number } | undefined;
  if (!current) {
    return { success: false, error: 'workflow not found' };
  }

  const newVersion = current.version + 1;
  const stepsJson = JSON.stringify(steps);

  const tx = database.transaction(() => {
    database.prepare(
      'UPDATE workflows SET steps = ?, version = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(stepsJson, newVersion, id);
    database.prepare(
      'INSERT INTO workflow_versions (workflow_id, version, snapshot) VALUES (?, ?, ?)'
    ).run(id, newVersion, stepsJson);
  });
  tx();

  return { success: true, workflow: getWorkflow(id) };
}

export function deleteWorkflow(id: string): { success: boolean; error?: string } {
  const database = getDb();
  const result = database.prepare('DELETE FROM workflows WHERE id = ?').run(id);
  if (result.changes === 0) {
    return { success: false, error: 'workflow not found' };
  }
  return { success: true };
}

export function countWorkflowsReferencingSkill(skillName: string): number {
  const rows = getDb().prepare('SELECT steps FROM workflows').all() as { steps: string }[];
  let count = 0;
  for (const row of rows) {
    try {
      const steps = JSON.parse(row.steps) as WorkflowStep[];
      if (stepsContainSkill(steps, skillName)) {
        count++;
      }
    } catch {}
  }
  return count;
}

function stepsContainSkill(steps: WorkflowStep[], skillName: string): boolean {
  for (const step of steps) {
    if (step.type === 'skill' && step.ref === skillName) {
      return true;
    }
    if (step.type === 'branch') {
      for (const branch of step.branches) {
        if (stepsContainSkill(branch.children, skillName)) return true;
      }
      if (step.default && stepsContainSkill(step.default, skillName)) return true;
    }
    if ((step.type === 'loop' || step.type === 'parallel') && stepsContainSkill(step.children, skillName)) {
      return true;
    }
  }
  return false;
}

export interface ExportDTO {
  id: string;
  name: string;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export function exportWorkflow(id: string): ExportDTO | null {
  const wf = getWorkflow(id);
  if (!wf) return null;
  return {
    id: wf.id,
    name: wf.name,
    steps: wf.steps,
    createdAt: wf.createdAt,
    updatedAt: wf.updatedAt,
  };
}

export function importWorkflow(payload: { name: string; steps: WorkflowStep[] }): OperationResult {
  const database = getDb();
  const existing = database.prepare('SELECT id FROM workflows WHERE name = ?').get(payload.name);
  if (existing) {
    return { success: false, error: 'name exists' };
  }

  const id = randomUUID();
  const stepsJson = JSON.stringify(payload.steps);

  const tx = database.transaction(() => {
    database.prepare(
      'INSERT INTO workflows (id, name, steps, version) VALUES (?, ?, ?, 1)'
    ).run(id, payload.name, stepsJson);
    database.prepare(
      'INSERT INTO workflow_versions (workflow_id, version, snapshot) VALUES (?, 1, ?)'
    ).run(id, stepsJson);
  });
  tx();

  return { success: true, workflow: getWorkflow(id) };
}

export function listVersions(workflowId: string): WorkflowVersion[] {
  const rows = getDb().prepare(
    'SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY created_at DESC'
  ).all(workflowId) as WorkflowVersionRow[];
  return rows.map(rowToVersion);
}

export function rollbackWorkflow(workflowId: string, versionId: number): OperationResult {
  const database = getDb();
  const snapshotRow = database.prepare(
    'SELECT snapshot, version FROM workflow_versions WHERE id = ? AND workflow_id = ?'
  ).get(versionId, workflowId) as { snapshot: string; version: number } | undefined;

  if (!snapshotRow) {
    return { success: false, error: 'version not found' };
  }

  const current = database.prepare('SELECT version FROM workflows WHERE id = ?').get(workflowId) as { version: number } | undefined;
  if (!current) {
    return { success: false, error: 'workflow not found' };
  }

  const newVersion = current.version + 1;
  const tx = database.transaction(() => {
    database.prepare(
      'UPDATE workflows SET steps = ?, version = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(snapshotRow.snapshot, newVersion, workflowId);
    database.prepare(
      'INSERT INTO workflow_versions (workflow_id, version, snapshot) VALUES (?, ?, ?)'
    ).run(workflowId, newVersion, snapshotRow.snapshot);
  });
  tx();

  return { success: true, workflow: getWorkflow(workflowId) };
}