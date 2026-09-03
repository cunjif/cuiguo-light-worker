import * as workflowStore from './workflow-store.js';
import * as skillEngine from './engine.js';
import type { WorkflowStep, Workflow, SkillStep, BranchStep, LoopStep, ParallelStep, WorkflowRefStep } from './workflow-store.js';
import type { InstalledSkill } from './types.js';

export interface RunResult {
  activeSkill: string;
  activeSkillPrompt: string;
  warnings: string[];
}

interface EvalContext {
  installed: InstalledSkill[];
  warnings: string[];
  visitedWorkflowIds: Set<string>;
  outputs: Record<string, any>[];
}

export function detectCycle(rootWorkflowId: string, refWorkflowId: string): boolean {
  const visited = new Set<string>();
  const stack = [refWorkflowId];

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    if (currentId === rootWorkflowId) return true;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const wf = workflowStore.getWorkflow(currentId);
    if (!wf) continue;

    for (const step of wf.steps) {
      if (step.type === 'workflow') {
        stack.push(step.ref);
      }
    }
  }

  return false;
}

async function evalSkill(step: SkillStep, ctx: EvalContext): Promise<{ prompt: string; ref: string } | null> {
  const installed = ctx.installed.find(s => s.name === step.ref);
  if (!installed || !installed.enabled) {
    ctx.warnings.push(`Step "${step.ref}" is not available (uninstalled or disabled)`);
    return null;
  }

  try {
    const prompt = skillEngine.getSkillSystemPrompt(step.ref, ctx.installed);
    if (!prompt) {
      ctx.warnings.push(`Failed to get prompt for step "${step.ref}"`);
      return null;
    }
    return { prompt: `[${step.ref}]\n${prompt}`, ref: step.ref };
  } catch (error: any) {
    ctx.warnings.push(`Error evaluating step "${step.ref}": ${error.message}`);
    return null;
  }
}

async function evalBranch(step: BranchStep, ctx: EvalContext): Promise<{ prompts: string[]; refs: string[] } | null> {
  const condition = step.condition;
  let hitBranch = false;
  let matchedChildren: WorkflowStep[] | undefined;

  try {
    hitBranch = evalCondition(condition, ctx.outputs);
    if (hitBranch) {
      matchedChildren = step.branches[0]?.children;
    } else {
      matchedChildren = step.default;
    }
  } catch (error: any) {
    ctx.warnings.push(`Branch condition error: ${error.message}`);
    matchedChildren = step.default;
  }

  if (!matchedChildren) return null;
  return await evalSteps(matchedChildren, ctx);
}

function evalCondition(condition: string, outputs: Record<string, any>[]): boolean {
  if (!condition || condition === 'true') return true;
  if (condition === 'false') return false;
  const lastOutput = outputs[outputs.length - 1];
  if (!lastOutput) return false;
  try {
    return Boolean(new Function('ctx', `return ${condition}`)(lastOutput));
  } catch {
    return false;
  }
}

async function evalLoop(step: LoopStep, ctx: EvalContext): Promise<{ prompts: string[]; refs: string[] } | null> {
  const allPrompts: string[] = [];
  const allRefs: string[] = [];
  const iterations = Math.max(0, Math.min(step.iterations, 100));

  for (let i = 0; i < iterations; i++) {
    const result = await evalSteps(step.children, ctx);
    if (result) {
      allPrompts.push(...result.prompts);
      allRefs.push(...result.refs);
    }
  }

  return { prompts: allPrompts, refs: allRefs };
}

async function evalParallel(step: ParallelStep, ctx: EvalContext): Promise<{ prompts: string[]; refs: string[] } | null> {
  const results = await Promise.all(step.children.map(child => evalSteps([child], ctx)));
  const allPrompts: string[] = [];
  const allRefs: string[] = [];

  for (const result of results) {
    if (result) {
      allPrompts.push(...result.prompts);
      allRefs.push(...result.refs);
    }
  }

  return { prompts: allPrompts, refs: allRefs };
}

async function evalWorkflowRef(step: WorkflowRefStep, ctx: EvalContext): Promise<{ prompts: string[]; refs: string[] } | null> {
  if (ctx.visitedWorkflowIds.has(step.ref)) {
    ctx.warnings.push(`Circular reference detected: workflow "${step.ref}" already visited`);
    return null;
  }

  const wf = workflowStore.getWorkflow(step.ref);
  if (!wf) {
    ctx.warnings.push(`Referenced workflow "${step.ref}" not found`);
    return null;
  }

  ctx.visitedWorkflowIds.add(step.ref);
  const result = await evalSteps(wf.steps, ctx);
  ctx.visitedWorkflowIds.delete(step.ref);
  return result;
}

async function evalSteps(steps: WorkflowStep[], ctx: EvalContext): Promise<{ prompts: string[]; refs: string[] } | null> {
  const prompts: string[] = [];
  const refs: string[] = [];

  for (const step of steps) {
    let result: { prompts: string[]; refs: string[] } | null = null;

    switch (step.type) {
      case 'skill': {
        const r = await evalSkill(step, ctx);
        if (r) {
          prompts.push(r.prompt);
          refs.push(r.ref);
        }
        break;
      }
      case 'branch':
        result = await evalBranch(step, ctx);
        break;
      case 'loop':
        result = await evalLoop(step, ctx);
        break;
      case 'parallel':
        result = await evalParallel(step, ctx);
        break;
      case 'workflow':
        result = await evalWorkflowRef(step, ctx);
        break;
    }

    if (result) {
      prompts.push(...result.prompts);
      refs.push(...result.refs);
    }
  }

  return { prompts, refs };
}

export async function runWorkflow(workflowId: string, currentInstalled: InstalledSkill[]): Promise<RunResult | null> {
  const wf = workflowStore.getWorkflow(workflowId);
  if (!wf) return null;

  const ctx: EvalContext = {
    installed: currentInstalled,
    warnings: [],
    visitedWorkflowIds: new Set([workflowId]),
    outputs: [],
  };

  const result = await evalSteps(wf.steps, ctx);
  if (!result || result.prompts.length === 0) {
    return {
      activeSkill: '',
      activeSkillPrompt: '',
      warnings: ctx.warnings,
    };
  }

  return {
    activeSkill: result.refs.join(' → '),
    activeSkillPrompt: result.prompts.join('\n\n---\n\n'),
    warnings: ctx.warnings,
  };
}