import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadTemplate } from '../lib/template-loader.js';
import type { NodeDef } from '../lib/types.js';

const EXTRA_HIGH_YML_PATH = new URL('../../templates/extra-high.yml', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const LOW_YML_PATH = new URL('../../templates/low.yml', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** Recursively find a node by ID in a NodeDef array. */
function findNode(nodes: NodeDef[], id: string): NodeDef | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if ('body' in node && Array.isArray(node.body)) {
      const found = findNode(node.body as NodeDef[], id);
      if (found) return found;
    }
    if ('branches' in node && node.branches) {
      const branches = node.branches as { true?: NodeDef[]; false?: NodeDef[] };
      if (Array.isArray(branches.true)) {
        const found = findNode(branches.true, id);
        if (found) return found;
      }
      if (Array.isArray(branches.false)) {
        const found = findNode(branches.false, id);
        if (found) return found;
      }
    }
    if ('children' in node && Array.isArray((node as { children?: NodeDef[] }).children)) {
      const found = findNode((node as { children: NodeDef[] }).children, id);
      if (found) return found;
    }
  }
  return undefined;
}

describe('loadTemplate', () => {
  describe('loading extra-high.yml', () => {
    it('loads and parses extra-high.yml with correct template header', () => {
      const result = loadTemplate(EXTRA_HIGH_YML_PATH);
      expect(result.template.template.id).toBe('extra-high');
      expect(result.template.template.version).toBe('1.0.0');
    });

    it('returns exactly 23 entries in the event index', () => {
      // extra-high has all nodes: requirements, master_plan, explode_master_plan,
      // plan_approval_gate, gate_mode_selection, phase_loop (with code_review + task_gate
      // in task_loop and phase_review + phase_gate in phase_loop), final_review, pr_gate,
      // final_approval_gate.
      const result = loadTemplate(EXTRA_HIGH_YML_PATH);
      expect(result.eventIndex.size).toBe(23);
    });
  });

  describe('event index — all 23 mappings for extra-high.yml', () => {
    const result = loadTemplate(EXTRA_HIGH_YML_PATH);
    const { eventIndex } = result;

    const cases: Array<[string, string, string, string]> = [
      ['requirements_started',             'requirements',        'started',   'requirements'],
      ['requirements_completed',           'requirements',        'completed', 'requirements'],
      ['master_plan_started',              'master_plan',         'started',   'master_plan'],
      ['master_plan_completed',            'master_plan',         'completed', 'master_plan'],
      ['explosion_started',                'explode_master_plan', 'started',   'explode_master_plan'],
      ['explosion_completed',              'explode_master_plan', 'completed', 'explode_master_plan'],
      ['plan_approved',                    'plan_approval_gate',  'approved',  'plan_approval_gate'],
      ['gate_mode_set',                    'gate_mode_selection', 'approved',  'gate_mode_selection'],
      ['execution_started',                'task_executor',       'started',   'phase_loop.body.task_loop.body.task_executor'],
      ['task_completed',                   'task_executor',       'completed', 'phase_loop.body.task_loop.body.task_executor'],
      ['code_review_started',              'code_review',         'started',   'phase_loop.body.task_loop.body.code_review'],
      ['code_review_completed',            'code_review',         'completed', 'phase_loop.body.task_loop.body.code_review'],
      ['task_gate_approved',               'task_gate',           'approved',  'phase_loop.body.task_loop.body.task_gate'],
      ['phase_review_started',             'phase_review',        'started',   'phase_loop.body.phase_review'],
      ['phase_review_completed',           'phase_review',        'completed', 'phase_loop.body.phase_review'],
      ['phase_gate_approved',              'phase_gate',          'approved',  'phase_loop.body.phase_gate'],
      ['commit_started',                   'commit',              'started',   'phase_loop.body.task_loop.body.commit_gate.branches.true.commit'],
      ['commit_completed',                 'commit',              'completed', 'phase_loop.body.task_loop.body.commit_gate.branches.true.commit'],
      ['final_review_started',             'final_review',        'started',   'final_review'],
      ['final_review_completed',           'final_review',        'completed', 'final_review'],
      ['final_approved',                   'final_approval_gate', 'approved',  'final_approval_gate'],
      ['pr_requested',                     'final_pr',            'started',   'pr_gate.branches.true.final_pr'],
      ['pr_created',                       'final_pr',            'completed', 'pr_gate.branches.true.final_pr'],
    ];

    for (const [eventName, expectedNodeId, expectedPhase, expectedPath] of cases) {
      it(`${eventName} → node=${expectedNodeId}, phase=${expectedPhase}, path=${expectedPath}`, () => {
        const entry = eventIndex.get(eventName);
        expect(entry, `entry for "${eventName}" should exist`).toBeDefined();
        expect(entry!.nodeDef.id).toBe(expectedNodeId);
        expect(entry!.eventPhase).toBe(expectedPhase);
        expect(entry!.templatePath).toBe(expectedPath);
      });
    }
  });

  describe('error handling', () => {
    it('throws containing "not found" for a non-existent file path', () => {
      expect(() => loadTemplate('/non/existent/path/to/template.yml')).toThrowError(/not found/);
    });

    it('re-throws original error for non-ENOENT filesystem errors (e.g. reading a directory)', () => {
      // Passing a directory path should NOT produce "not found" — it should
      // propagate the original EISDIR / EPERM / EACCES error
      const dirPath = os.tmpdir();
      expect(() => loadTemplate(dirPath)).toThrow();
      try {
        loadTemplate(dirPath);
      } catch (e) {
        // Error message should NOT say "not found" — the directory exists
        expect((e as Error).message).not.toMatch(/not found/);
      }
    });

    it('throws containing "Invalid YAML" for invalid YAML content', () => {
      const tmpFile = path.join(os.tmpdir(), `invalid-yaml-${Date.now()}.yml`);
      fs.writeFileSync(tmpFile, 'key: [unclosed bracket\n  bad: {{{{', 'utf-8');
      try {
        expect(() => loadTemplate(tmpFile)).toThrowError(/Invalid YAML/);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('throws containing "Malformed template" when template field is missing', () => {
      const tmpFile = path.join(os.tmpdir(), `missing-template-${Date.now()}.yml`);
      fs.writeFileSync(tmpFile, 'nodes:\n  - id: foo\n    kind: step\n', 'utf-8');
      try {
        expect(() => loadTemplate(tmpFile)).toThrowError(/Malformed template/);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('throws containing "Malformed template" when nodes field is missing', () => {
      const tmpFile = path.join(os.tmpdir(), `missing-nodes-${Date.now()}.yml`);
      fs.writeFileSync(
        tmpFile,
        'template:\n  id: test\n  version: "1.0.0"\n  description: "test"\n',
        'utf-8'
      );
      try {
        expect(() => loadTemplate(tmpFile)).toThrowError(/Malformed template/);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('throws containing "Malformed template" when nodes array is empty', () => {
      const tmpFile = path.join(os.tmpdir(), `empty-nodes-${Date.now()}.yml`);
      fs.writeFileSync(
        tmpFile,
        'template:\n  id: test\n  version: "1.0.0"\n  description: "test"\nnodes: []\n',
        'utf-8'
      );
      try {
        expect(() => loadTemplate(tmpFile)).toThrowError(/Malformed template/);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });

  describe('validation integration', () => {
    it('throws with message matching /cycle/i when template has a cycle in depends_on', () => {
      const tmpFile = path.join(os.tmpdir(), `cycle-template-${Date.now()}.yml`);
      fs.writeFileSync(
        tmpFile,
        [
          'template:',
          '  id: cycle-test',
          '  version: "1.0.0"',
          '  description: "cycle test"',
          'nodes:',
          '  - id: a',
          '    kind: step',
          '    depends_on: [b]',
          '    events:',
          '      started: a_started',
          '      completed: a_completed',
          '  - id: b',
          '    kind: step',
          '    depends_on: [a]',
          '    events:',
          '      started: b_started',
          '      completed: b_completed',
        ].join('\n'),
        'utf-8'
      );
      try {
        expect(() => loadTemplate(tmpFile)).toThrowError(/cycle/i);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('thrown cycle error message includes the template ID', () => {
      const templateId = `cycle-id-check-${Date.now()}`;
      const tmpFile = path.join(os.tmpdir(), `${templateId}.yml`);
      fs.writeFileSync(
        tmpFile,
        [
          'template:',
          '  id: cycle-id-check',
          '  version: "1.0.0"',
          '  description: "cycle test"',
          'nodes:',
          '  - id: a',
          '    kind: step',
          '    depends_on: [b]',
          '    events:',
          '      started: a_started',
          '      completed: a_completed',
          '  - id: b',
          '    kind: step',
          '    depends_on: [a]',
          '    events:',
          '      started: b_started',
          '      completed: b_completed',
        ].join('\n'),
        'utf-8'
      );
      try {
        expect(() => loadTemplate(tmpFile)).toThrowError(new RegExp(templateId));
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('throws with message matching /dangling/i when template has a dangling depends_on reference', () => {
      const tmpFile = path.join(os.tmpdir(), `dangling-template-${Date.now()}.yml`);
      fs.writeFileSync(
        tmpFile,
        [
          'template:',
          '  id: dangling-test',
          '  version: "1.0.0"',
          '  description: "dangling ref test"',
          'nodes:',
          '  - id: a',
          '    kind: step',
          '    depends_on: [nonexistent]',
          '    events:',
          '      started: a_started',
          '      completed: a_completed',
        ].join('\n'),
        'utf-8'
      );
      try {
        expect(() => loadTemplate(tmpFile)).toThrowError(/dangling/i);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });

  // ── extra-high.yml shape — canonical full-feature template ───────────────────
  describe('extra-high.yml shape (canonical full-feature template)', () => {
    it('loads extra-high.yml without errors', () => {
      expect(() => loadTemplate(EXTRA_HIGH_YML_PATH)).not.toThrow();
    });

    it('template header has id "extra-high" and is NOT marked deprecated', () => {
      const result = loadTemplate(EXTRA_HIGH_YML_PATH);
      expect(result.template.template.id).toBe('extra-high');
      expect(result.template.template.version).toBe('1.0.0');
      expect(result.template.template.description).toBeTruthy();
      // extra-high.yml is the full-feature template — it must NOT carry the deprecated status.
      expect((result.template.template as { status?: string }).status).not.toBe('deprecated');
    });

    it('all 9 expected top-level node ids are present in order', () => {
      const result = loadTemplate(EXTRA_HIGH_YML_PATH);
      const topLevelIds = result.template.nodes.map(n => n.id);
      expect(topLevelIds).toEqual([
        'requirements',
        'master_plan',
        'explode_master_plan',
        'plan_approval_gate',
        'gate_mode_selection',
        'phase_loop',
        'final_review',
        'pr_gate',
        'final_approval_gate',
      ]);
    });

    it('phase_loop has kind: for_each_phase and contains task_loop + phase_review + phase_gate as body children', () => {
      const result = loadTemplate(EXTRA_HIGH_YML_PATH);
      const phaseLoop = findNode(result.template.nodes, 'phase_loop');
      expect(phaseLoop).toBeDefined();
      expect(phaseLoop!.kind).toBe('for_each_phase');
      const body = (phaseLoop as { body?: NodeDef[] }).body;
      expect(Array.isArray(body)).toBe(true);
      const bodyIds = body!.map(n => n.id);
      expect(bodyIds).toEqual(['task_loop', 'phase_review', 'phase_gate']);
    });

    it('task_loop body contains task_executor + commit_gate + code_review + task_gate in order', () => {
      const result = loadTemplate(EXTRA_HIGH_YML_PATH);
      const taskLoop = findNode(result.template.nodes, 'task_loop');
      expect(taskLoop).toBeDefined();
      expect(taskLoop!.kind).toBe('for_each_task');
      const body = (taskLoop as { body?: NodeDef[] }).body;
      expect(Array.isArray(body)).toBe(true);
      const bodyIds = body!.map(n => n.id);
      expect(bodyIds).toEqual(['task_executor', 'commit_gate', 'code_review', 'task_gate']);
    });

    it('phase_gate auto_approve_modes is empty (verdict-based auto-approve handles autonomous mode)', () => {
      const result = loadTemplate(EXTRA_HIGH_YML_PATH);
      const phaseGate = findNode(result.template.nodes, 'phase_gate');
      expect(phaseGate).toBeDefined();
      expect((phaseGate as { auto_approve_modes?: string[] }).auto_approve_modes).toEqual([]);
    });
  });

  // ── low.yml shape — minimal template ──────────────────────────────────────
  describe('low.yml shape (minimal template)', () => {
    it('loads low.yml without errors', () => {
      expect(() => loadTemplate(LOW_YML_PATH)).not.toThrow();
    });

    it('template header has id "low" and is NOT marked deprecated', () => {
      const result = loadTemplate(LOW_YML_PATH);
      expect(result.template.template.id).toBe('low');
      expect(result.template.template.version).toBe('1.0.0');
      expect(result.template.template.description).toBeTruthy();
      expect((result.template.template as { status?: string }).status).not.toBe('deprecated');
    });

    it('task_loop body contains only task_executor + commit_gate (no per-task review)', () => {
      const result = loadTemplate(LOW_YML_PATH);
      const taskLoop = findNode(result.template.nodes, 'task_loop');
      expect(taskLoop).toBeDefined();
      const body = (taskLoop as { body?: NodeDef[] }).body;
      expect(Array.isArray(body)).toBe(true);
      const bodyIds = body!.map(n => n.id);
      expect(bodyIds).toEqual(['task_executor', 'commit_gate']);
    });

    it('phase_loop body contains only task_loop (no phase review)', () => {
      const result = loadTemplate(LOW_YML_PATH);
      const phaseLoop = findNode(result.template.nodes, 'phase_loop');
      expect(phaseLoop).toBeDefined();
      const body = (phaseLoop as { body?: NodeDef[] }).body;
      expect(Array.isArray(body)).toBe(true);
      const bodyIds = body!.map(n => n.id);
      expect(bodyIds).toEqual(['task_loop']);
    });
  });
});
