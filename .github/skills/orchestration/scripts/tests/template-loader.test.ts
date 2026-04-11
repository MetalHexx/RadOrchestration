import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadTemplate } from '../lib/template-loader.js';

const FULL_YML_PATH = new URL('../../templates/full.yml', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

describe('loadTemplate', () => {
  describe('loading full.yml', () => {
    it('loads and parses full.yml with correct template header', () => {
      const result = loadTemplate(FULL_YML_PATH);
      expect(result.template.template.id).toBe('full');
      expect(result.template.template.version).toBe('1.0.0');
    });

    it('returns exactly 33 entries in the event index', () => {
      const result = loadTemplate(FULL_YML_PATH);
      expect(result.eventIndex.size).toBe(33);
    });
  });

  describe('event index — all 33 mappings', () => {
    const result = loadTemplate(FULL_YML_PATH);
    const { eventIndex } = result;

    const cases: Array<[string, string, string, string]> = [
      ['research_started',                 'research',            'started',   'research'],
      ['research_completed',               'research',            'completed', 'research'],
      ['prd_started',                      'prd',                 'started',   'prd'],
      ['prd_completed',                    'prd',                 'completed', 'prd'],
      ['design_started',                   'design',              'started',   'design'],
      ['design_completed',                 'design',              'completed', 'design'],
      ['architecture_started',             'architecture',        'started',   'architecture'],
      ['architecture_completed',           'architecture',        'completed', 'architecture'],
      ['master_plan_started',              'master_plan',         'started',   'master_plan'],
      ['master_plan_completed',            'master_plan',         'completed', 'master_plan'],
      ['plan_approved',                    'plan_approval_gate',  'approved',  'plan_approval_gate'],
      ['gate_mode_set',                     'gate_mode_selection', 'approved',  'gate_mode_selection'],
      ['phase_planning_started',                      'phase_planning',      'started',   'phase_loop.body.phase_planning'],
      ['phase_plan_created',               'phase_planning',      'completed', 'phase_loop.body.phase_planning'],
      ['task_handoff_started',             'task_handoff',        'started',   'phase_loop.body.task_loop.body.task_handoff'],
      ['task_handoff_created',             'task_handoff',        'completed', 'phase_loop.body.task_loop.body.task_handoff'],
      ['execution_started',                'task_executor',       'started',   'phase_loop.body.task_loop.body.task_executor'],
      ['task_completed',              'task_executor',       'completed', 'phase_loop.body.task_loop.body.task_executor'],
      ['code_review_started',              'code_review',         'started',   'phase_loop.body.task_loop.body.code_review'],
      ['code_review_completed',            'code_review',         'completed', 'phase_loop.body.task_loop.body.code_review'],
      ['task_gate_approved',               'task_gate',           'approved',  'phase_loop.body.task_loop.body.task_gate'],
      ['phase_report_started',             'phase_report',        'started',   'phase_loop.body.phase_report'],
      ['phase_report_created',           'phase_report',        'completed', 'phase_loop.body.phase_report'],
      ['phase_review_started',             'phase_review',        'started',   'phase_loop.body.phase_review'],
      ['phase_review_completed',           'phase_review',        'completed', 'phase_loop.body.phase_review'],
      ['phase_gate_approved',              'phase_gate',          'approved',  'phase_loop.body.phase_gate'],
      ['commit_started',           'commit',              'started',   'phase_loop.body.task_loop.body.commit_gate.branches.true.commit'],
      ['commit_completed',         'commit',              'completed', 'phase_loop.body.task_loop.body.commit_gate.branches.true.commit'],
      ['final_review_started',             'final_review',        'started',   'final_review'],
      ['final_review_completed',           'final_review',        'completed', 'final_review'],
      ['final_approved',            'final_approval_gate', 'approved',  'final_approval_gate'],
      ['pr_requested',        'final_pr',            'started',   'pr_gate.branches.true.final_pr'],
      ['pr_created',      'final_pr',            'completed', 'pr_gate.branches.true.final_pr'],
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
});
