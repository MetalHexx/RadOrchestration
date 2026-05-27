// cli/tests/behavioral/pipeline/helpers/drive.ts
//
// Data-mapped event-chain driver for behavioral tests against
// runtime-config/templates/extra-high.yml. One map entry per reachable
// step node; the firing loop is shared across all targets.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processEvent } from '../../../../src/lib/pipeline-engine/engine.js';
import { readState, writeState, readConfig, readDocument, ensureDirectories } from '../../../../src/lib/pipeline-engine/state-io.js';
import type { PipelineResult, EventContext, IOAdapter } from '../../../../src/lib/pipeline-engine/types.js';
import type { World } from './world.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute path to runtime-config/templates/ resolved from this helper's location.
// The helper is at cli/tests/behavioral/pipeline/helpers/; five dirs up is the repo root.
const REAL_TEMPLATES_DIR = path.resolve(__dirname, '..', '..', '..', '..', '..', 'runtime-config', 'templates');

export interface ChainStep {
  event: string;
  context: Partial<EventContext>;
}

// Each chain is the sequence of events that, when fired in order against a
// fresh extra-high world, leaves the engine resolved at the named target
// step. The final processEvent return for the LAST event in the chain is
// the value returned by driveToNode.
export const EVENT_CHAINS: Record<string, ChainStep[]> = {
  requirements: [
    { event: 'start', context: {} },
  ],
  master_plan: [
    { event: 'start', context: {} },
    { event: 'requirements_completed', context: { doc_path: 'REQUIREMENTS.md' } },
  ],
  explode_master_plan: [
    { event: 'start', context: {} },
    { event: 'requirements_completed', context: { doc_path: 'REQUIREMENTS.md' } },
    { event: 'master_plan_completed', context: { doc_path: 'MASTER-PLAN.md' } },
  ],
  final_review: [
    // Reached after plan approval, gate-mode set, and a single phase + task
    // iteration is completed through phase_review and phase_gate.
    { event: 'start', context: {} },
    { event: 'requirements_completed', context: { doc_path: 'REQUIREMENTS.md' } },
    { event: 'master_plan_completed', context: { doc_path: 'MASTER-PLAN.md' } },
    { event: 'explosion_completed', context: {} },
    { event: 'plan_approved', context: {} },
    { event: 'gate_mode_set', context: { gate_mode: 'autonomous' } },
    { event: 'task_completed', context: { verdict: 'approved' } },
    { event: 'code_review_completed', context: { doc_path: 'CR.md', verdict: 'approved' } },
    { event: 'phase_review_completed', context: { doc_path: 'PR.md', verdict: 'approved' } },
  ],
  task_executor: [
    { event: 'start', context: {} },
    { event: 'requirements_completed', context: { doc_path: 'REQUIREMENTS.md' } },
    { event: 'master_plan_completed', context: { doc_path: 'MASTER-PLAN.md' } },
    { event: 'explosion_completed', context: {} },
    { event: 'plan_approved', context: {} },
    { event: 'gate_mode_set', context: { gate_mode: 'autonomous' } },
  ],
  commit: [
    // Reached only when pipeline.source_control.auto_commit !== 'never';
    // tests covering `commit` must seed source_control via source_control_init.
    { event: 'start', context: {} },
    { event: 'requirements_completed', context: { doc_path: 'REQUIREMENTS.md' } },
    { event: 'master_plan_completed', context: { doc_path: 'MASTER-PLAN.md' } },
    { event: 'explosion_completed', context: {} },
    { event: 'plan_approved', context: {} },
    { event: 'gate_mode_set', context: { gate_mode: 'autonomous' } },
    { event: 'source_control_init', context: { auto_commit: 'task', auto_pr: 'never' } },
    { event: 'task_completed', context: { verdict: 'approved' } },
  ],
  code_review: [
    { event: 'start', context: {} },
    { event: 'requirements_completed', context: { doc_path: 'REQUIREMENTS.md' } },
    { event: 'master_plan_completed', context: { doc_path: 'MASTER-PLAN.md' } },
    { event: 'explosion_completed', context: {} },
    { event: 'plan_approved', context: {} },
    { event: 'gate_mode_set', context: { gate_mode: 'autonomous' } },
    { event: 'task_completed', context: { verdict: 'approved' } },
  ],
  phase_review: [
    { event: 'start', context: {} },
    { event: 'requirements_completed', context: { doc_path: 'REQUIREMENTS.md' } },
    { event: 'master_plan_completed', context: { doc_path: 'MASTER-PLAN.md' } },
    { event: 'explosion_completed', context: {} },
    { event: 'plan_approved', context: {} },
    { event: 'gate_mode_set', context: { gate_mode: 'autonomous' } },
    { event: 'task_completed', context: { verdict: 'approved' } },
    { event: 'code_review_completed', context: { doc_path: 'CR.md', verdict: 'approved' } },
  ],
  final_pr: [
    { event: 'start', context: {} },
    { event: 'requirements_completed', context: { doc_path: 'REQUIREMENTS.md' } },
    { event: 'master_plan_completed', context: { doc_path: 'MASTER-PLAN.md' } },
    { event: 'explosion_completed', context: {} },
    { event: 'plan_approved', context: {} },
    { event: 'gate_mode_set', context: { gate_mode: 'autonomous' } },
    { event: 'source_control_init', context: { auto_commit: 'never', auto_pr: 'final' } },
    { event: 'task_completed', context: { verdict: 'approved' } },
    { event: 'code_review_completed', context: { doc_path: 'CR.md', verdict: 'approved' } },
    { event: 'phase_review_completed', context: { doc_path: 'PR.md', verdict: 'approved' } },
    { event: 'final_review_completed', context: { doc_path: 'FR.md', verdict: 'approved' } },
  ],
};

function makeFilesystemIO(): IOAdapter {
  return { readState, writeState, readConfig, readDocument, ensureDirectories };
}

/**
 * Ensure the world's templatesDir has `extra-high.yml` so that the engine can
 * load it during `start` with state===null. `buildWorld` writes the template
 * body as `template.yml`; the engine for a brand-new project explicitly loads
 * from `templatesDir/<name>.yml` (bypassing the project-local `template.yml`
 * shortcut). We copy the file from the real runtime-config/templates/ directory
 * if it is not already present in the world's templatesDir.
 */
function ensureExtraHighInTemplatesDir(world: World): void {
  const dest = path.join(world.pathContext.templatesDir, 'extra-high.yml');
  if (!fs.existsSync(dest)) {
    const src = path.join(REAL_TEMPLATES_DIR, 'extra-high.yml');
    fs.copyFileSync(src, dest);
  }
}

export async function driveToNode(world: World, targetNodeId: keyof typeof EVENT_CHAINS): Promise<PipelineResult> {
  const chain = EVENT_CHAINS[targetNodeId];
  if (!chain) {
    throw new Error(`driveToNode: no chain registered for ${String(targetNodeId)}`);
  }
  // Ensure the engine can find extra-high.yml in the world's templatesDir for
  // the `start` event (state===null path in the engine always loads from
  // templatesDir/<name>.yml, not the project-local template.yml snapshot).
  ensureExtraHighInTemplatesDir(world);
  const io = makeFilesystemIO();
  let result!: PipelineResult;
  for (const step of chain) {
    result = processEvent(step.event, world.projectDir, step.context, io, world.pathContext, world.configPath);
  }
  return result;
}
