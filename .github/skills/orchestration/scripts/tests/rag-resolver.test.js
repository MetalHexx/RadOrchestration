'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolveNextAction } = require('../lib/resolver.js');

function makeCompleteState(kcOverrides = {}) {
  return {
    $schema: 'orchestration-state-v4',
    project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:01.000Z' },
    pipeline: { current_tier: 'complete', gate_mode: null },
    planning: { status: 'complete', human_approved: true, steps: [] },
    execution: { status: 'complete', current_phase: 1, phases: [] },
    final_review: { status: 'complete', doc_path: 'FINAL-REVIEW.md', human_approved: true },
    knowledge_compilation: { status: 'not_started', doc_path: null, ...kcOverrides },
  };
}

const ragEnabledConfig = {
  limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 2 },
  human_gates: { execution_mode: 'autonomous', after_final_review: true },
  rag: { enabled: true },
};

const ragDisabledConfig = {
  limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 2 },
  human_gates: { execution_mode: 'autonomous', after_final_review: true },
  rag: { enabled: false },
};

const noRagConfig = {
  limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 2 },
  human_gates: { execution_mode: 'autonomous', after_final_review: true },
};

describe('COMPLETE tier with RAG enabled', () => {
  it('spawns knowledge compiler when knowledge_compilation is not_started', () => {
    const result = resolveNextAction(makeCompleteState(), ragEnabledConfig);
    assert.equal(result.action, 'spawn_knowledge_compiler');
  });

  it('spawns knowledge compiler when knowledge_compilation is in_progress', () => {
    const result = resolveNextAction(makeCompleteState({ status: 'in_progress' }), ragEnabledConfig);
    assert.equal(result.action, 'spawn_knowledge_compiler');
  });

  it('returns display_complete when knowledge_compilation is complete', () => {
    const result = resolveNextAction(
      makeCompleteState({ status: 'complete', doc_path: 'KC.md' }),
      ragEnabledConfig,
    );
    assert.equal(result.action, 'display_complete');
  });

  it('returns display_complete when knowledge_compilation is skipped', () => {
    const result = resolveNextAction(
      makeCompleteState({ status: 'skipped' }),
      ragEnabledConfig,
    );
    assert.equal(result.action, 'display_complete');
  });
});

describe('COMPLETE tier with RAG disabled', () => {
  it('returns display_complete immediately', () => {
    const result = resolveNextAction(makeCompleteState(), ragDisabledConfig);
    assert.equal(result.action, 'display_complete');
  });
});

describe('COMPLETE tier with no RAG config', () => {
  it('returns display_complete immediately', () => {
    const result = resolveNextAction(makeCompleteState(), noRagConfig);
    assert.equal(result.action, 'display_complete');
  });
});
