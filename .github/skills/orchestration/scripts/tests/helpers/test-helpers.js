'use strict';

// ─── Deep Clone ─────────────────────────────────────────────────────────────

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ─── Default Config ─────────────────────────────────────────────────────────

function createDefaultConfig() {
  return {
    projects: { base_path: 'custom/project-store', naming: 'SCREAMING_CASE' },
    limits: {
      max_phases: 10,
      max_tasks_per_phase: 8,
      max_retries_per_task: 2,
      max_consecutive_review_rejections: 3,
    },
    human_gates: { after_planning: true, execution_mode: 'autonomous', after_final_review: true },
    source_control: { auto_commit: 'ask', auto_pr: 'ask', provider: 'github' },
  };
}

// ─── Mock IO ────────────────────────────────────────────────────────────────

function createMockIO({ state = null, documents = {}, config = null } = {}) {
  const initialState = state !== null ? deepClone(state) : null;
  let currentState = initialState !== null ? deepClone(initialState) : null;
  const writes = [];
  let ensureDirsCalled = 0;
  const effectiveConfig = config !== null ? deepClone(config) : createDefaultConfig();

  return {
    readState(_projectDir) {
      return currentState !== null ? deepClone(currentState) : null;
    },
    writeState(_projectDir, newState) {
      const snapshot = deepClone(newState);
      writes.push(snapshot);
      currentState = deepClone(newState);
    },
    readConfig(_configPath) {
      return deepClone(effectiveConfig);
    },
    readDocument(docPath) {
      const doc = documents[docPath];
      return doc ? deepClone(doc) : null;
    },
    ensureDirectories(_projectDir) {
      ensureDirsCalled++;
    },
    getState() {
      return currentState;
    },
    getWrites() {
      return writes;
    },
    getEnsureDirsCalled() {
      return ensureDirsCalled;
    },
  };
}

// ─── State Factories ────────────────────────────────────────────────────────

function createBaseState(overrides = {}) {
  const now = new Date().toISOString();
  const base = {
    $schema: 'orchestration-state-v4',
    project: { name: 'TEST', created: now, updated: now },
    pipeline: { current_tier: 'planning' },
    planning: {
      status: 'not_started',
      human_approved: false,
      steps: [
        { name: 'research', status: 'not_started', doc_path: null },
        { name: 'prd', status: 'not_started', doc_path: null },
        { name: 'design', status: 'not_started', doc_path: null },
        { name: 'architecture', status: 'not_started', doc_path: null },
        { name: 'master_plan', status: 'not_started', doc_path: null },
      ],
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
  };
  const { config, ...rest } = overrides;
  const state = Object.keys(rest).length > 0 ? deepMerge(base, rest) : base;
  if (config !== undefined) {
    state.config = deepClone(config);
  }
  return state;
}

function createExecutionState(overrides = {}) {
  const now = new Date().toISOString();
  const base = {
    $schema: 'orchestration-state-v4',
    project: { name: 'TEST', created: now, updated: now },
    pipeline: { current_tier: 'execution', gate_mode: 'autonomous' },
    planning: {
      status: 'complete',
      human_approved: true,
      steps: [
        { name: 'research', status: 'complete', doc_path: 'docs/research.md' },
        { name: 'prd', status: 'complete', doc_path: 'docs/prd.md' },
        { name: 'design', status: 'complete', doc_path: 'docs/design.md' },
        { name: 'architecture', status: 'complete', doc_path: 'docs/architecture.md' },
        { name: 'master_plan', status: 'complete', doc_path: 'docs/master_plan.md' },
      ],
    },
    execution: {
      status: 'in_progress',
      current_phase: 1,
      phases: [{
        name: 'Phase 1',
        status: 'in_progress',
        stage: 'executing',
        current_task: 1,
        tasks: [
          {
            name: 'T01',
            status: 'not_started',
            stage: 'planning',
            docs: { handoff: null, review: null },
            review: { verdict: null, action: null },
            retries: 0,
          },
          {
            name: 'T02',
            status: 'not_started',
            stage: 'planning',
            docs: { handoff: null, review: null },
            review: { verdict: null, action: null },
            retries: 0,
          },
        ],
        docs: { phase_plan: 'phases/PHASE-01.md', phase_report: null, phase_review: null },
        review: { verdict: null, action: null },
      }],
    },
    final_review: {
      status: 'not_started',
      doc_path: null,
      human_approved: false,
    },
  };
  const { config, ...rest } = overrides;
  const state = Object.keys(rest).length > 0 ? deepMerge(base, rest) : base;
  if (config !== undefined) {
    state.config = deepClone(config);
  }
  return state;
}

function createReviewState(overrides = {}) {
  const now = new Date().toISOString();
  const base = {
    $schema: 'orchestration-state-v4',
    project: { name: 'TEST', created: now, updated: now },
    pipeline: { current_tier: 'review' },
    planning: {
      status: 'complete',
      human_approved: true,
      steps: [
        { name: 'research', status: 'complete', doc_path: 'docs/research.md' },
        { name: 'prd', status: 'complete', doc_path: 'docs/prd.md' },
        { name: 'design', status: 'complete', doc_path: 'docs/design.md' },
        { name: 'architecture', status: 'complete', doc_path: 'docs/architecture.md' },
        { name: 'master_plan', status: 'complete', doc_path: 'docs/master_plan.md' },
      ],
    },
    execution: {
      status: 'complete',
      current_phase: 1,
      phases: [{
        name: 'Phase 1',
        status: 'complete',
        stage: 'complete',
        current_task: 1,
        tasks: [{
          name: 'T01',
          status: 'complete',
          stage: 'complete',
          docs: { handoff: 'h.md', review: 'rv.md' },
          review: { verdict: 'approved', action: 'advanced' },
          retries: 0,
        }],
        docs: { phase_plan: 'pp.md', phase_report: 'pr.md', phase_review: 'prv.md' },
        review: { verdict: 'approved', action: 'advanced' },
      }],
    },
    final_review: {
      status: 'not_started',
      doc_path: null,
      human_approved: false,
    },
  };
  const { config, ...rest } = overrides;
  const state = Object.keys(rest).length > 0 ? deepMerge(base, rest) : base;
  if (config !== undefined) {
    state.config = deepClone(config);
  }
  return state;
}

// ─── Process And Assert ─────────────────────────────────────────────────────

const { processEvent } = require('../../lib/pipeline-engine');

function processAndAssert(event, context, io, assertions) {
  const result = processEvent(event, '/test/project', context, io);
  // Always assert PipelineResult shape
  if (assertions.success !== undefined) {
    const assert = require('node:assert/strict');
    assert.equal(result.success, assertions.success, `expected success=${assertions.success}`);
  }
  if (assertions.action !== undefined) {
    const assert = require('node:assert/strict');
    assert.equal(result.action, assertions.action, `expected action=${assertions.action}`);
  }
  if (assertions.writeCount !== undefined) {
    const assert = require('node:assert/strict');
    assert.equal(io.getWrites().length, assertions.writeCount, `expected ${assertions.writeCount} write(s)`);
  }
  return result;
}

// ─── Deep Merge Utility ─────────────────────────────────────────────────────

function deepMerge(target, source) {
  const result = deepClone(target);
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      result[key] !== null &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], source[key]);
    } else {
      result[key] = deepClone(source[key]);
    }
  }
  return result;
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  createDefaultConfig,
  createMockIO,
  createBaseState,
  createExecutionState,
  createReviewState,
  processAndAssert,
  deepClone,
};
