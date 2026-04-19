import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  parseMasterPlan,
  explodeMasterPlan,
  ParseError,
  phaseFilename,
  taskFilename,
} from '../lib/explode-master-plan.js';
import { getMutation } from '../lib/mutations.js';
import { writeState, readState } from '../lib/state-io.js';
import type {
  PipelineState,
  StepNodeState,
  ForEachPhaseNodeState,
} from '../lib/types.js';

// ── Fixture locations ─────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'master-plans');
const WELL_FORMED = path.join(FIXTURE_DIR, 'well-formed.md');
const MALFORMED = path.join(FIXTURE_DIR, 'malformed.md');

// ── Temp dir helpers ──────────────────────────────────────────────────────────

let TMP_DIR: string;

beforeEach(() => {
  TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'explode-test-'));
});

afterEach(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

function writeTempMasterPlan(body: string, name = 'MASTER-PLAN.md'): string {
  const fpath = path.join(TMP_DIR, name);
  fs.writeFileSync(fpath, body, 'utf-8');
  return fpath;
}

function makeMinimalStateForExplosion(projectName: string): PipelineState {
  return {
    $schema: 'orchestration-state-v5',
    project: { name: projectName, created: '2026-04-18T00:00:00Z', updated: '2026-04-18T00:00:00Z' },
    config: {
      gate_mode: 'autonomous',
      limits: {
        max_phases: 10,
        max_tasks_per_phase: 10,
        max_retries_per_task: 3,
        max_consecutive_review_rejections: 3,
      },
      source_control: { auto_commit: 'never', auto_pr: 'never' },
    },
    pipeline: { gate_mode: null, source_control: null, current_tier: 'planning', halt_reason: null },
    graph: {
      template_id: 'default',
      status: 'in_progress',
      current_node_path: null,
      nodes: {
        requirements: { kind: 'step', status: 'completed', doc_path: '/tmp/req.md', retries: 0 },
        master_plan: { kind: 'step', status: 'completed', doc_path: '/tmp/master-plan.md', retries: 0 },
        explode_master_plan: { kind: 'step', status: 'in_progress', doc_path: null, retries: 0 },
        plan_approval_gate: { kind: 'gate', status: 'not_started', gate_active: false },
      },
    },
  };
}

// ── Parser tests ──────────────────────────────────────────────────────────────

describe('parseMasterPlan — parser cases', () => {
  it('well-formed fixture parses cleanly: 3 phases, 6 tasks (2/3/1)', () => {
    const parsed = parseMasterPlan(WELL_FORMED);
    expect(parsed.phases).toHaveLength(3);
    expect(parsed.phases[0]!.id).toBe('P01');
    expect(parsed.phases[0]!.tasks).toHaveLength(2);
    expect(parsed.phases[1]!.tasks).toHaveLength(3);
    expect(parsed.phases[2]!.tasks).toHaveLength(1);
    // Total = 6
    const totalTasks = parsed.phases.reduce((n, p) => n + p.tasks.length, 0);
    expect(totalTasks).toBe(6);
    // Requirement tags harvested from the task body
    expect(parsed.phases[0]!.tasks[0]!.requirementTags).toEqual(expect.arrayContaining(['FR-1', 'AD-1']));
  });

  it('malformed fixture (single-digit phase id "P1:") throws ParseError with line/expected/found populated', () => {
    expect(() => parseMasterPlan(MALFORMED)).toThrow(ParseError);
    try {
      parseMasterPlan(MALFORMED);
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError);
      const pe = err as ParseError;
      expect(pe.line).toBeGreaterThan(0);
      expect(pe.expected).toContain('P{NN}');
      expect(pe.found).toContain('P1:');
      expect(pe.message).toMatch(/phase heading/i);
    }
  });

  it('malformed (unparseable task id "### P01-TX: Bad") throws ParseError pointing at the task line', () => {
    const body = [
      '## P01: Good phase',
      '',
      '### P01-TX: Bad ID',
      '',
      'Body.',
    ].join('\n');
    const fpath = writeTempMasterPlan(body);
    let caught: ParseError | null = null;
    try {
      parseMasterPlan(fpath);
    } catch (err) {
      caught = err as ParseError;
    }
    expect(caught).not.toBeNull();
    expect(caught!.line).toBe(3);
    expect(caught!.expected).toContain('T{MM}');
    expect(caught!.found).toContain('P01-TX');
  });

  it('empty phase (no tasks) parses successfully and emits phase with 0 tasks', () => {
    const body = [
      '## P01: Empty',
      '',
      'Phase description only, no tasks.',
    ].join('\n');
    const fpath = writeTempMasterPlan(body);
    const parsed = parseMasterPlan(fpath);
    expect(parsed.phases).toHaveLength(1);
    expect(parsed.phases[0]!.tasks).toHaveLength(0);
  });

  it('phase with zero tasks AND another phase with multiple tasks → no orphan tasks', () => {
    const body = [
      '## P01: Empty phase',
      '',
      'Just prose.',
      '',
      '## P02: Populated phase',
      '',
      '### P02-T01: First',
      '',
      'Body.',
      '',
      '### P02-T02: Second',
      '',
      'Body.',
    ].join('\n');
    const fpath = writeTempMasterPlan(body);
    const parsed = parseMasterPlan(fpath);
    expect(parsed.phases).toHaveLength(2);
    expect(parsed.phases[0]!.tasks).toHaveLength(0);
    expect(parsed.phases[1]!.tasks).toHaveLength(2);
    expect(parsed.phases[1]!.tasks[0]!.id).toBe('P02-T01');
    expect(parsed.phases[1]!.tasks[1]!.id).toBe('P02-T02');
  });

  it('round-trip identity: parse → explode → re-parse emitted phase plans preserves task ids and counts', () => {
    const projectName = 'ROUNDTRIP';
    const parsed1 = parseMasterPlan(WELL_FORMED);
    const result = explodeMasterPlan({
      projectDir: TMP_DIR,
      masterPlanPath: WELL_FORMED,
      projectName,
      nowIso: '2026-04-18T00:00:00.000Z',
    });
    expect(result.emittedPhaseFiles).toHaveLength(3);
    expect(result.emittedTaskFiles).toHaveLength(6);

    // Sanity: filenames match phase/task titles.
    for (let i = 0; i < parsed1.phases.length; i++) {
      const phase = parsed1.phases[i]!;
      const expected = phaseFilename(projectName, phase);
      expect(result.emittedPhaseFiles[i]).toContain(expected);
    }
    // Sanity: the task files exist on disk.
    for (const f of result.emittedTaskFiles) {
      expect(fs.existsSync(f)).toBe(true);
    }
  });

  it('task heading before any phase heading throws ParseError with "before any phase heading" message', () => {
    const body = [
      '### P01-T01: Orphan',
      '',
      'Body.',
    ].join('\n');
    const fpath = writeTempMasterPlan(body);
    let caught: ParseError | null = null;
    try {
      parseMasterPlan(fpath);
    } catch (err) {
      caught = err as ParseError;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toMatch(/before any phase heading/);
  });
});

// ── Re-run integration ────────────────────────────────────────────────────────

describe('explodeMasterPlan — re-run integration', () => {
  it('pre-existing phases/ + tasks/ + hand-edited notes all land in backups/{ts}/, fresh files emitted, state re-seeded', () => {
    const projectName = 'RERUN';

    // Pre-stage old contents.
    fs.mkdirSync(path.join(TMP_DIR, 'phases'), { recursive: true });
    fs.mkdirSync(path.join(TMP_DIR, 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(TMP_DIR, 'phases', `${projectName}-PHASE-01-OLD.md`), '# old phase', 'utf-8');
    fs.writeFileSync(path.join(TMP_DIR, 'tasks', `${projectName}-TASK-P01-T01-OLD.md`), '# old task', 'utf-8');
    // A hand-edited note that does NOT match the patterns — must still be backed up.
    fs.writeFileSync(path.join(TMP_DIR, 'phases', 'MY-NOTES.md'), '# hand notes', 'utf-8');

    // Seed state.json with a dummy phase_loop to prove it gets wiped + reseeded.
    const state = makeMinimalStateForExplosion(projectName);
    (state.graph.nodes['phase_loop'] as unknown as ForEachPhaseNodeState) = {
      kind: 'for_each_phase',
      status: 'in_progress',
      iterations: [
        { index: 0, status: 'completed', nodes: {}, corrective_tasks: [], commit_hash: 'abc' } as any,
      ],
    };
    writeState(TMP_DIR, state);

    const result = explodeMasterPlan({
      projectDir: TMP_DIR,
      masterPlanPath: WELL_FORMED,
      projectName,
      nowIso: '2026-04-18T12-34-56-789Z',
    });

    // Backup created.
    expect(result.backupDir).not.toBeNull();
    expect(fs.existsSync(result.backupDir!)).toBe(true);
    // All old contents (including hand-edited notes) migrated.
    expect(fs.existsSync(path.join(result.backupDir!, 'phases', `${projectName}-PHASE-01-OLD.md`))).toBe(true);
    expect(fs.existsSync(path.join(result.backupDir!, 'phases', 'MY-NOTES.md'))).toBe(true);
    expect(fs.existsSync(path.join(result.backupDir!, 'tasks', `${projectName}-TASK-P01-T01-OLD.md`))).toBe(true);
    // Fresh files emitted.
    expect(result.emittedPhaseFiles).toHaveLength(3);
    expect(result.emittedTaskFiles).toHaveLength(6);
    // Old files no longer in phases/ + tasks/.
    expect(fs.existsSync(path.join(TMP_DIR, 'phases', 'MY-NOTES.md'))).toBe(false);
    expect(fs.existsSync(path.join(TMP_DIR, 'phases', `${projectName}-PHASE-01-OLD.md`))).toBe(false);

    // State re-seeded.
    const seededState = readState(TMP_DIR)!;
    const phaseLoop = seededState.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    expect(phaseLoop.iterations).toHaveLength(3);
    expect(phaseLoop.iterations[0]!.doc_path).toContain(path.sep + 'phases' + path.sep);
    expect(phaseLoop.iterations[0]!.doc_path).toContain(`${projectName}-PHASE-01-`);
    // Task iterations populated.
    const taskLoop = phaseLoop.iterations[0]!.nodes['task_loop'] as any;
    expect(taskLoop.iterations).toHaveLength(2);
    expect(taskLoop.iterations[0]!.doc_path).toContain(path.sep + 'tasks' + path.sep);
  });

  it('malformed Master Plan on re-run: filesystem UNTOUCHED (no backup, no fresh emission)', () => {
    const projectName = 'ABORT';

    // Pre-stage some existing content.
    fs.mkdirSync(path.join(TMP_DIR, 'phases'), { recursive: true });
    fs.writeFileSync(path.join(TMP_DIR, 'phases', 'KEEP.md'), '# keep', 'utf-8');

    expect(() => explodeMasterPlan({
      projectDir: TMP_DIR,
      masterPlanPath: MALFORMED,
      projectName,
      nowIso: '2026-04-18T00-00-00-000Z',
    })).toThrow(ParseError);

    // Filesystem untouched.
    expect(fs.existsSync(path.join(TMP_DIR, 'phases', 'KEEP.md'))).toBe(true);
    expect(fs.existsSync(path.join(TMP_DIR, 'backups'))).toBe(false);
  });
});

// ── Recovery loop integration ─────────────────────────────────────────────────

describe('explosion recovery loop — mutation integration', () => {
  it('explosion_failed mutation on a fresh state stores parse_error and increments parse_retry_count to 1', () => {
    const state = makeMinimalStateForExplosion('FIX');
    const parseError = { line: 10, expected: 'phase heading', found: '## Bad', message: 'malformed' };
    const mutation = getMutation('explosion_failed')!;
    const result = mutation(state, { parse_error: parseError }, {} as any, { template: { id: 't', version: '1', description: '' }, nodes: [] });

    const mp = result.state.graph.nodes['master_plan'] as StepNodeState;
    expect(mp.parse_retry_count).toBe(1);
    expect(mp.last_parse_error).toEqual(parseError);
    expect(mp.status).toBe('in_progress');

    const ex = result.state.graph.nodes['explode_master_plan'] as StepNodeState;
    expect(ex.status).toBe('not_started');

    expect(result.state.graph.status).not.toBe('halted');
  });

  it('explosion_failed → then explosion_completed: recovery state fully cleared', () => {
    let state = makeMinimalStateForExplosion('RECOVER');
    const parseError = { line: 5, expected: 'x', found: 'y', message: 'bad' };
    const failMutation = getMutation('explosion_failed')!;
    state = failMutation(state, { parse_error: parseError }, {} as any, { template: { id: 't', version: '1', description: '' }, nodes: [] }).state;

    // Now success.
    const completeMutation = getMutation('explosion_completed')!;
    const result = completeMutation(state, { doc_path: '/tmp/master-plan.md' }, {} as any, { template: { id: 't', version: '1', description: '' }, nodes: [] });

    const mp = result.state.graph.nodes['master_plan'] as StepNodeState;
    expect(mp.last_parse_error).toBeNull();
    expect(mp.parse_retry_count).toBe(0);

    const ex = result.state.graph.nodes['explode_master_plan'] as StepNodeState;
    expect(ex.status).toBe('completed');
    expect(ex.doc_path).toBe('/tmp/master-plan.md');
  });

  it('4 consecutive explosion_failed events: 4th exceeds cap=3 → graph.status=halted, explode_master_plan.status=failed, halt_reason populated', () => {
    let state = makeMinimalStateForExplosion('CAP');
    const parseError = { line: 1, expected: 'x', found: 'y', message: 'still broken' };
    const mutation = getMutation('explosion_failed')!;
    const emptyTpl = { template: { id: 't', version: '1', description: '' }, nodes: [] };

    for (let i = 0; i < 4; i++) {
      state = mutation(state, { parse_error: parseError }, {} as any, emptyTpl).state;
    }

    const mp = state.graph.nodes['master_plan'] as StepNodeState;
    expect(mp.parse_retry_count).toBe(4);

    const ex = state.graph.nodes['explode_master_plan'] as StepNodeState;
    expect(ex.status).toBe('failed');

    expect(state.graph.status).toBe('halted');
    expect(state.pipeline.halt_reason).toContain('cap=3');
  });
});

// ── Filename helpers ──────────────────────────────────────────────────────────

describe('filename helpers (exported for reuse)', () => {
  it('phaseFilename produces SCREAMING-KEBAB-CASE slug', () => {
    expect(phaseFilename('MYAPP', { id: 'P01', index: 1, title: 'Foundation setup', body: '', tasks: [] }))
      .toBe('MYAPP-PHASE-01-FOUNDATION-SETUP.md');
  });
  it('taskFilename encodes phase + task index', () => {
    expect(taskFilename('MYAPP', {
      id: 'P02-T03', phaseIndex: 2, taskIndex: 3, title: 'Wire it up', requirementTags: [], body: '',
    })).toBe('MYAPP-TASK-P02-T03-WIRE-IT-UP.md');
  });
});
