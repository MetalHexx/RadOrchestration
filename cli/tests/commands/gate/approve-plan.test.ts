import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runApprovePlan } from '../../../src/commands/gate/approve-plan.js';

// Resolve the canonical templates dir (one walk above the cli root) so
// processEvent('start') can snapshot the medium template into the project.
const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'skills', 'rad-orchestration', 'templates');

function makeProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-approve-plan-'));
  // Snapshot the medium template into the project so resolveTemplatePath
  // finds the project-local file without needing the bundle's templatesDir.
  fs.copyFileSync(path.join(TEMPLATES_DIR, 'medium.yml'), path.join(dir, 'template.yml'));
  return dir;
}

async function scaffoldToPlanApprovalGate(dir: string): Promise<void> {
  // Reach into the pipeline lib directly to drive the project from start to
  // a state where plan_approved is the next legal event. Mirrors the
  // bring-up sequence in tests/fixtures/parity-states.ts.
  const { processEvent } = await import('../../../../skills/rad-orchestration/scripts/lib/engine.js');
  const { readState, writeState, readConfig, readDocument, ensureDirectories } =
    await import('../../../../skills/rad-orchestration/scripts/lib/state-io.js');
  const pathContext = {
    scriptsDir: path.resolve(__dirname, '..', '..', '..', '..', 'skills', 'rad-orchestration', 'scripts'),
    templatesDir: TEMPLATES_DIR,
    orchRoot: path.basename(path.resolve(__dirname, '..', '..', '..', '..')),
  };
  const io = { readState, writeState, readConfig, readDocument, ensureDirectories };

  processEvent('start', dir, { template: 'medium' }, io, pathContext);

  // Mark requirements + master_plan + explode steps as completed with doc paths
  const state = readState(dir)!;
  const reqDoc = path.join(dir, 'requirements.md');
  fs.writeFileSync(reqDoc, '---\nproject: gate-test\ntype: requirements\n---\n# requirements\n');
  const mpDoc = path.join(dir, 'master-plan.md');
  fs.writeFileSync(mpDoc, '---\nproject: gate-test\ntype: master_plan\ntotal_phases: 1\ntotal_tasks: 1\n---\n# master plan\n');
  // requirements completion
  processEvent('requirements_started', dir, {}, io, pathContext);
  processEvent('requirements_completed', dir, { doc_path: reqDoc }, io, pathContext);
  processEvent('master_plan_started', dir, {}, io, pathContext);
  processEvent('master_plan_completed', dir, { doc_path: mpDoc }, io, pathContext);
  processEvent('explosion_started', dir, {}, io, pathContext);
  processEvent('explosion_completed', dir, {}, io, pathContext);
  // After explosion_completed walkDAG should reach plan_approval_gate and
  // emit request_plan_approval; the gate node is now ready for plan_approved.
  void state;
}

describe('radorch gate approve plan (FR-13, AD-5)', () => {
  let cwdBefore: string;
  beforeEach(() => { cwdBefore = process.cwd(); });
  afterEach(() => { process.chdir(cwdBefore); });

  it('mutates state to plan_approved and emits the pipeline.js-shaped envelope', async () => {
    const dir = makeProject();
    await scaffoldToPlanApprovalGate(dir);

    const result = await runApprovePlan({ projectDir: dir });

    expect(result.success).toBe(true);
    expect(result.orchRoot).toBeTruthy();
    const state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
    // Mutation contract: pipeline.current_tier becomes 'execution' and the
    // plan_approval_gate transitions to completed.
    expect(state.pipeline.current_tier).toBe('execution');
    expect(state.graph.nodes.plan_approval_gate.status).toBe('completed');
  });

  it('does not consult cwd for path resolution (AD-6)', async () => {
    const dir = makeProject();
    await scaffoldToPlanApprovalGate(dir);

    process.chdir(os.tmpdir());
    const result = await runApprovePlan({ projectDir: dir });

    expect(result.success).toBe(true);
    const state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
    // Mutation actually landed despite unrelated cwd
    expect(state.graph.nodes.plan_approval_gate.status).toBe('completed');
  });
});
