import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { enrichActionContext, resolveActivePhaseIndex, resolveActiveTaskIndex, type EnrichmentInput } from '../../../src/lib/pipeline-engine/context-enrichment.js';
import { makeV6State } from '../../helpers/state-factory.js';
import type { PipelineState } from '../../../src/lib/pipeline-engine/types.js';

function makeTmpRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-'));
  const skillDir = path.join(root, 'packages/x/skills/demo');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'),
    '---\nname: demo\ndescription: a demo skill\n---\nbody\n', 'utf8');
  return root;
}

// Minimal runtime input for spawn_requirements — that branch only reads
// `action`, `walkerContext`, and (transitively) `process.cwd()`. The remaining
// fields are required structurally on `EnrichmentInput`, so we stub-and-cast
// rather than fabricate a full `PipelineState`/`OrchestrationConfig`.
function makeInput(): EnrichmentInput {
  return {
    action: 'spawn_requirements',
    walkerContext: {},
    state: { graph: { nodes: {} }, pipeline: {} } as unknown as EnrichmentInput['state'],
    config: { limits: { max_phases: 10, max_tasks_per_phase: 8 } } as unknown as EnrichmentInput['config'],
    cliContext: {},
  };
}

/**
 * Build a v6 state with one task iteration whose repos[0].commit_hash is set.
 * Used to test that spawn_code_reviewer reads head_sha from repos[0].commit_hash (FR-26).
 */
function stateWithTaskCommit(repoName: string, commitHash: string): PipelineState {
  const s = makeV6State({ taskRepos: [{ name: repoName, commit_hash: commitHash }] });
  // Mark the phase and task iterations as in_progress so resolveActivePhaseIndex
  // and resolveActiveTaskIndex resolve to phase=1, task=1.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phaseIter = (s as any).graph.nodes.phase_loop.iterations[0];
  phaseIter.status = 'in_progress';
  phaseIter.nodes.task_loop.iterations[0].status = 'in_progress';
  return s as unknown as PipelineState;
}

function makeEnrichmentInput(action: string, state: PipelineState): EnrichmentInput {
  return {
    action,
    walkerContext: {},
    state,
    config: { limits: { max_phases: 10, max_tasks_per_phase: 8 } } as unknown as EnrichmentInput['config'],
    cliContext: {},
  };
}

describe('context-enrichment skills block', () => {
  it('spawn_requirements enrichment emits Repository Skills Available block (no subprocess hop)', () => {
    const root = makeTmpRepo();
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const r = enrichActionContext(makeInput());
      expect(r.repository_skills_block).toMatch(/## Repository Skills Available/);
      expect(r.repository_skills_block).toMatch(/"name": "demo"/);
      expect(r.repository_skills_block).toMatch(/Entries above are a catalog\./);
    } finally { process.chdir(cwd); }
  });

  it('empty manifest yields empty string', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-empty-'));
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const r = enrichActionContext(makeInput());
      expect(r.repository_skills_block).toBe('');
    } finally { process.chdir(cwd); }
  });
});

describe('context-enrichment spawn_code_reviewer head_sha (FR-26)', () => {
  it('reads head_sha from repos[0].commit_hash for spawn_code_reviewer (FR-26)', () => {
    const ctx = enrichActionContext(makeEnrichmentInput('spawn_code_reviewer', stateWithTaskCommit('backend', 'def5678')));
    expect(ctx.head_sha).toBe('def5678');
  });
});

// Build a phase loop where every regular iteration is `completed` (so the
// pre-fix resolvers fall through to `return 1`) but phase index 4 carries an
// in_progress phase-scope corrective — the PROJECT-GRAPH-2 shape.
function stateWithPhaseCorrective(): PipelineState {
  const completedTaskLoop = {
    kind: 'for_each_task',
    status: 'completed',
    iterations: [
      { index: 0, status: 'completed', doc_path: null, repos: [], corrective_tasks: [], nodes: {} },
    ],
  };
  const mkPhase = (index: number, status: string, correctives: unknown[]) => ({
    index,
    status,
    doc_path: null,
    repos: [],
    corrective_tasks: correctives,
    nodes: { task_loop: structuredClone(completedTaskLoop) },
  });
  return {
    graph: {
      nodes: {
        phase_loop: {
          kind: 'for_each_phase',
          status: 'in_progress',
          iterations: [
            mkPhase(0, 'completed', []),
            mkPhase(1, 'completed', []),
            mkPhase(2, 'completed', []),
            mkPhase(3, 'in_progress', [
              { index: 1, status: 'in_progress', reason: 'r', injected_after: 'phase_review', nodes: {}, repos: [] },
            ]),
          ],
        },
      },
    },
  } as unknown as PipelineState;
}

function stateResolvingToOne(): PipelineState {
  return {
    graph: {
      nodes: {
        phase_loop: {
          kind: 'for_each_phase',
          status: 'in_progress',
          iterations: [
            {
              index: 0,
              status: 'in_progress',
              doc_path: null,
              repos: [],
              corrective_tasks: [],
              nodes: {
                task_loop: {
                  kind: 'for_each_task',
                  status: 'in_progress',
                  iterations: [
                    { index: 0, status: 'in_progress', doc_path: null, repos: [], corrective_tasks: [], nodes: {} },
                  ],
                },
              },
            },
          ],
        },
      },
    },
  } as unknown as PipelineState;
}

describe('corrective-aware resolvers (FR-1, FR-2, NFR-1)', () => {
  it('resolves the active phase-scope corrective phase, not node 1 (FR-1)', () => {
    const state = stateWithPhaseCorrective();
    expect(resolveActivePhaseIndex(state)).toBe(4);
    expect(resolveActiveTaskIndex(state, 4)).toBe(1);
  });

  it('fails loud when no active node can be resolved (FR-2)', () => {
    // All phases completed, no correctives, no in_progress/not_started.
    const state = stateWithPhaseCorrective();
    (state as unknown as { graph: { nodes: { phase_loop: { iterations: { status: string; corrective_tasks: unknown[] }[] } } } })
      .graph.nodes.phase_loop.iterations.forEach(it => { it.status = 'completed'; it.corrective_tasks = []; });
    expect(() => resolveActivePhaseIndex(state)).toThrow(/no active phase|unresolved/i);
  });

  it('still resolves to phase 1 / task 1 when that is genuinely correct (NFR-1)', () => {
    const state = stateResolvingToOne();
    expect(resolveActivePhaseIndex(state)).toBe(1);
    expect(resolveActiveTaskIndex(state, 1)).toBe(1);
  });
});
