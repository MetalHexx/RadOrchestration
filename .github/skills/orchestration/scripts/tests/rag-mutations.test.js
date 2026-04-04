'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getMutation } = require('../lib/mutations.js');

function makeCompleteState() {
  return {
    $schema: 'orchestration-state-v4',
    project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:01.000Z' },
    pipeline: { current_tier: 'complete', gate_mode: null },
    planning: { status: 'complete', human_approved: true, steps: [] },
    execution: { status: 'complete', current_phase: 1, phases: [] },
    final_review: { status: 'complete', doc_path: 'FINAL-REVIEW.md', human_approved: true },
    knowledge_compilation: { status: 'not_started', doc_path: null },
  };
}

const defaultConfig = { limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 2 }, human_gates: { execution_mode: 'autonomous', after_final_review: true } };

describe('knowledge_compilation_started', () => {
  it('transitions knowledge_compilation to in_progress', () => {
    const fn = getMutation('knowledge_compilation_started');
    assert.ok(fn, 'mutation should exist');
    const state = makeCompleteState();
    const result = fn(state, {}, defaultConfig);
    assert.equal(result.state.knowledge_compilation.status, 'in_progress');
  });
});

describe('knowledge_compilation_completed', () => {
  it('sets doc_path and status to complete', () => {
    const fn = getMutation('knowledge_compilation_completed');
    assert.ok(fn, 'mutation should exist');
    const state = makeCompleteState();
    state.knowledge_compilation.status = 'in_progress';
    const result = fn(state, { doc_path: 'MYAPP-PROJECT-KNOWLEDGE.md' }, defaultConfig);
    assert.equal(result.state.knowledge_compilation.status, 'complete');
    assert.equal(result.state.knowledge_compilation.doc_path, 'MYAPP-PROJECT-KNOWLEDGE.md');
  });
});

describe('knowledge_compilation_skipped', () => {
  it('sets status to skipped', () => {
    const fn = getMutation('knowledge_compilation_skipped');
    assert.ok(fn, 'mutation should exist');
    const state = makeCompleteState();
    const result = fn(state, {}, defaultConfig);
    assert.equal(result.state.knowledge_compilation.status, 'skipped');
  });
});
