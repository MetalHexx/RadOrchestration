import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runApproveFinal } from '../../../src/commands/gate/approve-final.js';

const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'skills', 'rad-orchestration', 'templates');

/**
 * Build a project at the final_approval_gate. Cheaper than driving the full
 * pipeline: scaffold via `start`, then write a hand-crafted state where every
 * predecessor node carries `status: completed` so the final-approved mutation
 * can land without DAG-walker objections.
 */
async function makeProjectAtFinalGate(): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-approve-final-'));
  fs.copyFileSync(path.join(TEMPLATES_DIR, 'medium.yml'), path.join(dir, 'template.yml'));
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

  // Mutate the state directly: mark every top-level node up to final_approval_gate
  // as completed, then write it back. The engine's standard route only requires
  // the mutation's target node to exist — it does NOT re-walk predecessors.
  const state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
  for (const nodeId of ['requirements', 'master_plan', 'explode_master_plan',
    'plan_approval_gate', 'gate_mode_selection', 'phase_loop', 'final_review', 'pr_gate']) {
    if (state.graph.nodes[nodeId]) {
      state.graph.nodes[nodeId].status = 'completed';
    }
  }
  // The final_approval_gate must exist as a scaffolded node before the mutation
  // can resolve it.
  state.pipeline.current_tier = 'review';
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state, null, 2));
  return dir;
}

describe('radorch gate approve final (FR-13, AD-5)', () => {
  it('mutates final_approval_gate to completed and emits the pipeline.js-shaped envelope', async () => {
    const dir = await makeProjectAtFinalGate();
    const result = await runApproveFinal({ projectDir: dir });

    expect(result.success).toBe(true);
    expect(result.orchRoot).toBeTruthy();
    const state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
    expect(state.graph.nodes.final_approval_gate.status).toBe('completed');
    expect(state.graph.nodes.final_approval_gate.gate_active).toBe(true);
  });

  it('does not consult cwd for path resolution (AD-6)', async () => {
    const dir = await makeProjectAtFinalGate();
    const cwdBefore = process.cwd();
    process.chdir(os.tmpdir());
    try {
      const result = await runApproveFinal({ projectDir: dir });
      expect(result.success).toBe(true);
      const state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
      expect(state.graph.nodes.final_approval_gate.status).toBe('completed');
    } finally {
      process.chdir(cwdBefore);
    }
  });
});
