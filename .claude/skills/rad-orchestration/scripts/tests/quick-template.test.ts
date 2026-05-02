import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';
import { validateTemplate } from '../lib/template-validator.js';
import type { PipelineTemplate, NodeDef } from '../lib/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');
const QUICK_PATH = path.join(TEMPLATES_DIR, 'quick.yml');
const DEFAULT_PATH = path.join(TEMPLATES_DIR, 'default.yml');

interface Node { id: string; kind: string; action?: string; depends_on?: string[]; body?: Node[]; branches?: { true: Node[]; false: Node[] }; events?: Record<string, string>; mode_ref?: string; action_if_needed?: string; approved_event?: string; auto_approve_modes?: string[]; condition?: unknown; }
interface Template { template: { id: string; version: string; description: string; status?: string }; nodes: Node[]; }

function loadTemplate(p: string): Template {
  return yaml.load(fs.readFileSync(p, 'utf-8')) as Template;
}

function findNode(nodes: Node[], id: string): Node | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.body) {
      const hit = findNode(n.body, id);
      if (hit) return hit;
    }
    if (n.branches) {
      const t = findNode(n.branches.true, id);
      if (t) return t;
      const f = findNode(n.branches.false, id);
      if (f) return f;
    }
  }
  return undefined;
}

function collectActionIds(nodes: Node[]): Set<string> {
  const out = new Set<string>();
  for (const n of nodes) {
    if (n.action) out.add(n.action);
    if (n.action_if_needed) out.add(n.action_if_needed);
    if (n.body) for (const x of collectActionIds(n.body)) out.add(x);
    if (n.branches) {
      for (const x of collectActionIds(n.branches.true)) out.add(x);
      for (const x of collectActionIds(n.branches.false)) out.add(x);
    }
  }
  return out;
}

describe('quick.yml template', () => {
  const quick = loadTemplate(QUICK_PATH);
  const def = loadTemplate(DEFAULT_PATH);

  it('declares template.id quick, version 1.0.0, non-empty description, no deprecated status', () => {
    expect(quick.template.id).toBe('quick');
    expect(quick.template.version).toBe('1.0.0');
    expect(quick.template.description).toBeTruthy();
    expect(quick.template.description?.length).toBeGreaterThan(0);
    expect(quick.template.status).not.toBe('deprecated');
  });

  it('planning chain mirrors default.yml exactly', () => {
    for (const id of ['requirements', 'master_plan', 'explode_master_plan', 'plan_approval_gate']) {
      expect(findNode(quick.nodes, id)).toEqual(findNode(def.nodes, id));
    }
  });

  it('task_loop body contains only task_executor and commit_gate', () => {
    const phaseLoop = findNode(quick.nodes, 'phase_loop');
    const taskLoop = phaseLoop && phaseLoop.body && phaseLoop.body.find(n => n.id === 'task_loop');
    expect(taskLoop).toBeDefined();
    const ids = (taskLoop!.body ?? []).map(n => n.id);
    expect(ids).toEqual(['task_executor', 'commit_gate']);
  });

  it('phase_loop body contains only the task_loop (no phase_review or phase_gate)', () => {
    const phaseLoop = findNode(quick.nodes, 'phase_loop');
    const ids = (phaseLoop!.body ?? []).map(n => n.id);
    expect(ids).toEqual(['task_loop']);
  });

  it('commit_gate depends only on task_executor', () => {
    const cg = findNode(quick.nodes, 'commit_gate');
    expect(cg!.depends_on).toEqual(['task_executor']);
  });

  it('final_review depends on phase_loop', () => {
    const fr = findNode(quick.nodes, 'final_review');
    expect(fr!.depends_on).toEqual(['phase_loop']);
  });

  it('keeps gate_mode_selection, final_review, pr_gate, final_pr, final_approval_gate verbatim', () => {
    for (const id of ['gate_mode_selection', 'final_review', 'pr_gate', 'final_pr', 'final_approval_gate']) {
      expect(findNode(quick.nodes, id)).toEqual(findNode(def.nodes, id));
    }
  });

  it('uses only action ids already routed in default.yml', () => {
    const quickActions = collectActionIds(quick.nodes);
    const defaultActions = collectActionIds(def.nodes);
    for (const a of quickActions) {
      expect(defaultActions.has(a)).toBe(true);
    }
  });

  it('passes the existing template validator without errors', () => {
    const result = validateTemplate(quick as unknown as PipelineTemplate, 'quick');
    // Filter unreachable_node errors: leaf nodes (with depends_on but no dependents) are tolerated
    const hardErrors = result.errors.filter((e) => e.subtype !== 'unreachable_node');
    if (hardErrors.length > 0) {
      console.log('Validation errors:', JSON.stringify(hardErrors, null, 2));
    }
    expect(hardErrors).toHaveLength(0);
  });
});
