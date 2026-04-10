import { describe, it, expect } from 'vitest';
import { validateStateSchema } from '../lib/schema-validator.js';
import type { PipelineState } from '../lib/types.js';

// ── Minimal state factory ─────────────────────────────────────────────────────

/**
 * Creates a schema-valid minimal PipelineState with no graph nodes.
 * Used as the baseline fixture for schema-validator tests.
 */
function makeMinimalState(): PipelineState {
  return {
    $schema: 'orchestration-state-v5',
    project: {
      name: 'SCHEMA-VALIDATOR-TEST',
      created: '2025-01-01T00:00:00Z',
      updated: '2025-01-01T00:00:00Z',
    },
    config: {
      gate_mode: 'ask',
      limits: {
        max_phases: 10,
        max_tasks_per_phase: 8,
        max_retries_per_task: 2,
        max_consecutive_review_rejections: 3,
      },
      source_control: { auto_commit: 'ask', auto_pr: 'ask' },
    },
    pipeline: {
      gate_mode: null,
      source_control: null,
      current_tier: 'planning',
      halt_reason: null,
    },
    graph: {
      template_id: 'full',
      status: 'not_started',
      current_node_path: null,
      nodes: {},
    },
  };
}

/** Creates a valid SourceControlState for use in pipeline.source_control tests. */
function makeSourceControlState() {
  return {
    branch: 'feature/test',
    base_branch: 'main',
    worktree_path: '/tmp/test-worktree',
    auto_commit: 'always' as const,
    auto_pr: 'always' as const,
    remote_url: null,
    compare_url: null,
    pr_url: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('validateStateSchema', () => {
  it('valid scaffolded state returns 0 errors', () => {
    const state = makeMinimalState();
    const errors = validateStateSchema(state);
    expect(errors).toEqual([]);
  });

  it('state missing required field (project.name) returns ≥1 error with [schema] prefix containing the field path', () => {
    const state = makeMinimalState();
    delete (state.project as any).name;
    const errors = validateStateSchema(state);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]).toMatch(/^\[schema\] /);
    expect(errors[0]).toContain('project');
    expect(errors[0]).toContain('name');
  });

  it('state with wrong type (max_phases set to string) returns error describing type mismatch', () => {
    const state = makeMinimalState();
    (state.config.limits as any).max_phases = 'ten';
    const errors = validateStateSchema(state);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    const typeError = errors.find(e => e.includes('max_phases'));
    expect(typeError).toBeDefined();
    expect(typeError!).toMatch(/^\[schema\] /);
    expect(typeError!).toContain('integer');
  });

  it('state with invalid enum value (graph.status = "running") returns error with field path and allowed values', () => {
    const state = makeMinimalState();
    (state.graph as any).status = 'running';
    const errors = validateStateSchema(state);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    const enumError = errors.find(e => e.includes('graph.status'));
    expect(enumError).toBeDefined();
    expect(enumError!).toMatch(/^\[schema\] /);
    expect(enumError!).toContain('not_started');
    expect(enumError!).toContain('in_progress');
    expect(enumError!).toContain('completed');
    expect(enumError!).toContain('halted');
  });

  it('state with unexpected pipeline.source_control.commit_hash returns error with migration hint', () => {
    const state = makeMinimalState();
    state.pipeline.source_control = makeSourceControlState();
    (state.pipeline.source_control as any).commit_hash = 'abc123';
    const errors = validateStateSchema(state);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    const extraPropError = errors.find(e => e.includes('commit_hash'));
    expect(extraPropError).toBeDefined();
    expect(extraPropError!).toMatch(/^\[schema\] /);
    expect(extraPropError!).toContain('global commit_hash was removed in v5');
  });

  it('multiple violations in a single state all appear in the returned array (no fail-fast)', () => {
    const state = makeMinimalState();
    // Violation 1: invalid graph status enum
    (state.graph as any).status = 'running';
    // Violation 2: missing required field $schema
    delete (state as any).$schema;
    const errors = validateStateSchema(state);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('every error string in any returned array starts with "[schema] "', () => {
    const state = makeMinimalState();
    (state.graph as any).status = 'running';
    delete (state.project as any).name;
    (state.config.limits as any).max_phases = 'ten';
    const errors = validateStateSchema(state);
    expect(errors.length).toBeGreaterThan(0);
    for (const error of errors) {
      expect(error).toMatch(/^\[schema\] /);
    }
  });

  it('valid state after mutation to source_control with all required fields returns 0 errors', () => {
    const state = makeMinimalState();
    state.pipeline.source_control = makeSourceControlState();
    const errors = validateStateSchema(state);
    expect(errors).toEqual([]);
  });
});
