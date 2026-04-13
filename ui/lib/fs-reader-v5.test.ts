/**
 * Tests for fs-reader v5 state support.
 * Run with: npx tsx ui/lib/fs-reader-v5.test.ts
 */
import assert from 'node:assert';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { discoverProjects, readProjectState } from './fs-reader';

let passed = 0;
let failed = 0;
let tmpDir = '';

/** Minimal v5 state.json fixture */
function makeV5State(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    $schema: 'orchestration-state-v5',
    project: {
      name: 'v5-project',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-04-10T08:00:00.000Z',
    },
    config: {
      gate_mode: 'task',
      limits: {
        max_phases: 10,
        max_tasks_per_phase: 20,
        max_retries_per_task: 3,
        max_consecutive_review_rejections: 3,
      },
      source_control: {
        auto_commit: 'always',
        auto_pr: 'never',
      },
    },
    pipeline: {
      gate_mode: 'task',
      source_control: null,
      current_tier: 'execution',
      halt_reason: null,
    },
    graph: {
      template_id: 'default',
      status: 'in_progress',
      current_node_path: 'phase_loop',
      nodes: {
        research: { kind: 'step', status: 'completed', doc_path: 'reports/RESEARCH.md', retries: 0 },
        prd: { kind: 'step', status: 'completed', doc_path: 'reports/PRD.md', retries: 0 },
        design: { kind: 'step', status: 'completed', doc_path: 'reports/DESIGN.md', retries: 0 },
        architecture: { kind: 'step', status: 'completed', doc_path: 'reports/ARCHITECTURE.md', retries: 0 },
        master_plan: { kind: 'step', status: 'completed', doc_path: 'reports/MASTER-PLAN.md', retries: 0 },
        phase_loop: { kind: 'for_each_phase', status: 'in_progress', iterations: [] },
        final_review: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
      },
    },
    ...overrides,
  });
}

/** Minimal v4 state.json fixture */
function makeV4State() {
  return JSON.stringify({
    $schema: 'orchestration-state-v4',
    project: {
      name: 'v4-project',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-03-15T10:00:00.000Z',
    },
    pipeline: {
      current_tier: 'planning',
      gate_mode: null,
    },
    planning: {
      status: 'in_progress',
      human_approved: false,
      steps: [],
    },
    execution: {
      status: 'not_started',
      current_phase: 0,
      phases: [],
    },
    final_review: {
      status: 'not_started',
      doc_path: null,
      human_approved: false,
    },
  });
}

async function setup(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fs-reader-v5-test-'));

  // v5-project: valid v5 state.json (execution tier, in_progress graph)
  await mkdir(path.join(dir, 'v5-project'));
  await writeFile(path.join(dir, 'v5-project', 'state.json'), makeV5State());

  // v5-completed-project: v5 state with graph.status === 'completed'
  await mkdir(path.join(dir, 'v5-completed-project'));
  await writeFile(
    path.join(dir, 'v5-completed-project', 'state.json'),
    makeV5State({
      pipeline: {
        gate_mode: null,
        source_control: null,
        current_tier: 'execution',
        halt_reason: null,
      },
      graph: {
        template_id: 'default',
        status: 'completed',
        current_node_path: null,
        nodes: {
          research: { kind: 'step', status: 'completed', doc_path: 'reports/RESEARCH.md', retries: 0 },
          prd: { kind: 'step', status: 'completed', doc_path: 'reports/PRD.md', retries: 0 },
          design: { kind: 'step', status: 'completed', doc_path: 'reports/DESIGN.md', retries: 0 },
          architecture: { kind: 'step', status: 'completed', doc_path: 'reports/ARCHITECTURE.md', retries: 0 },
          master_plan: { kind: 'step', status: 'completed', doc_path: 'reports/MASTER-PLAN.md', retries: 0 },
          phase_loop: { kind: 'for_each_phase', status: 'completed', iterations: [] },
          final_review: { kind: 'step', status: 'completed', doc_path: 'reports/FINAL-REVIEW.md', retries: 0 },
        },
      },
    })
  );

  // v4-project: valid v4 state.json
  await mkdir(path.join(dir, 'v4-project'));
  await writeFile(path.join(dir, 'v4-project', 'state.json'), makeV4State());

  // no-state-project: directory without state.json
  await mkdir(path.join(dir, 'no-state-project'));

  // malformed-project: state.json with invalid JSON
  await mkdir(path.join(dir, 'malformed-project'));
  await writeFile(path.join(dir, 'malformed-project', 'state.json'), 'not valid json{{{');

  return dir;
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`);
    failed++;
  }
}

async function run() {
  try {
    tmpDir = await setup();
    const projects = await discoverProjects(tmpDir, '.');

    console.log('discoverProjects — v5 state support');

    await test('v5 project — schemaVersion is "v5"', async () => {
      const p = projects.find(x => x.name === 'v5-project');
      assert.ok(p, 'v5-project should be in results');
      assert.strictEqual(p!.schemaVersion, 'v5');
    });

    await test('v5 project — tier mapped from pipeline.current_tier', async () => {
      const p = projects.find(x => x.name === 'v5-project');
      assert.ok(p, 'v5-project should be in results');
      assert.strictEqual(p!.tier, 'execution');
    });

    await test('v5 project — planningStatus derived from graph nodes (all planning nodes completed → "complete")', async () => {
      const p = projects.find(x => x.name === 'v5-project');
      assert.ok(p, 'v5-project should be in results');
      assert.strictEqual(p!.planningStatus, 'complete');
    });

    await test('v5 project — executionStatus derived from graph (phase_loop in_progress → "in_progress")', async () => {
      const p = projects.find(x => x.name === 'v5-project');
      assert.ok(p, 'v5-project should be in results');
      assert.strictEqual(p!.executionStatus, 'in_progress');
    });

    await test('v5 project — lastUpdated from project.updated', async () => {
      const p = projects.find(x => x.name === 'v5-project');
      assert.ok(p, 'v5-project should be in results');
      assert.strictEqual(p!.lastUpdated, '2026-04-10T08:00:00.000Z');
    });

    await test('v5 project — hasState: true, hasMalformedState: false', async () => {
      const p = projects.find(x => x.name === 'v5-project');
      assert.ok(p, 'v5-project should be in results');
      assert.strictEqual(p!.hasState, true);
      assert.strictEqual(p!.hasMalformedState, false);
    });

    await test('v5 completed project — tier is "complete" when graph.status === "completed"', async () => {
      const p = projects.find(x => x.name === 'v5-completed-project');
      assert.ok(p, 'v5-completed-project should be in results');
      assert.strictEqual(p!.tier, 'complete');
    });

    await test('v4 project — schemaVersion is "v4" (no regression)', async () => {
      const p = projects.find(x => x.name === 'v4-project');
      assert.ok(p, 'v4-project should be in results');
      assert.strictEqual(p!.schemaVersion, 'v4');
    });

    await test('v4 project — tier, planningStatus, executionStatus unchanged (no regression)', async () => {
      const p = projects.find(x => x.name === 'v4-project');
      assert.ok(p, 'v4-project should be in results');
      assert.strictEqual(p!.tier, 'planning');
      assert.strictEqual(p!.planningStatus, 'in_progress');
      assert.strictEqual(p!.executionStatus, 'not_started');
    });

    await test('no-state project — hasState: false, schemaVersion undefined (no regression)', async () => {
      const p = projects.find(x => x.name === 'no-state-project');
      assert.ok(p, 'no-state-project should be in results');
      assert.strictEqual(p!.hasState, false);
      assert.strictEqual(p!.schemaVersion, undefined);
    });

    await test('malformed-state project — hasMalformedState: true (no regression)', async () => {
      const p = projects.find(x => x.name === 'malformed-project');
      assert.ok(p, 'malformed-project should be in results');
      assert.strictEqual(p!.hasMalformedState, true);
    });

    // readProjectState tests
    console.log('\nreadProjectState — v5 state support');

    await test('readProjectState — parses v5 state and returns $schema === "orchestration-state-v5"', async () => {
      const projectDir = path.join(tmpDir, 'v5-project');
      const state = await readProjectState(projectDir);
      assert.ok(state, 'state should not be null');
      assert.strictEqual(state!.$schema, 'orchestration-state-v5');
    });

    await test('readProjectState — parses v4 state correctly (no regression)', async () => {
      const projectDir = path.join(tmpDir, 'v4-project');
      const state = await readProjectState(projectDir);
      assert.ok(state, 'state should not be null');
      assert.strictEqual(state!.$schema, 'orchestration-state-v4');
    });

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }
}

run();
