'use strict';

// ─── Deep Clone ─────────────────────────────────────────────────────────────

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ─── Default Config ─────────────────────────────────────────────────────────

function createDefaultConfig() {
  return {
    projects: { base_path: '.github/projects', naming: 'SCREAMING_CASE' },
    limits: {
      max_phases: 10,
      max_tasks_per_phase: 8,
      max_retries_per_task: 2,
      max_consecutive_review_rejections: 3,
    },
    errors: {
      severity: {
        critical: ['build_failure', 'security_vulnerability', 'architectural_violation', 'data_loss_risk'],
        minor: ['test_failure', 'lint_error', 'review_suggestion', 'missing_test_coverage', 'style_violation'],
      },
      on_critical: 'halt',
      on_minor: 'retry',
    },
    human_gates: { after_planning: true, execution_mode: 'ask', after_final_review: true },
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

function createBaseState(overrides) {
  const now = new Date().toISOString();
  const base = {
    $schema: 'orchestration-state-v3',
    project: { name: 'TEST', created: now, updated: now },
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
      current_step: 'research',
    },
    execution: {
      status: 'not_started',
      current_tier: 'planning',
      current_phase: 0,
      total_phases: 0,
      phases: [],
    },
  };
  if (overrides) {
    return deepMerge(base, overrides);
  }
  return base;
}

function createExecutionState(overrides) {
  const now = new Date().toISOString();
  const base = {
    $schema: 'orchestration-state-v3',
    project: { name: 'TEST', created: now, updated: now },
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
      current_step: 'master_plan',
    },
    execution: {
      status: 'in_progress',
      current_tier: 'execution',
      current_phase: 0,
      total_phases: 1,
      phases: [{
        name: 'Phase 1',
        status: 'in_progress',
        current_task: 0,
        total_tasks: 2,
        tasks: [
          { name: 'T01', status: 'not_started', handoff_doc: null, report_doc: null, review_doc: null, review_verdict: null, review_action: null, has_deviations: false, deviation_type: null, retries: 0, report_status: null },
          { name: 'T02', status: 'not_started', handoff_doc: null, report_doc: null, review_doc: null, review_verdict: null, review_action: null, has_deviations: false, deviation_type: null, retries: 0, report_status: null },
        ],
        phase_plan_doc: 'phases/PHASE-01.md',
        phase_report_doc: null,
        phase_review_doc: null,
        phase_review_verdict: null,
        phase_review_action: null,
      }],
    },
  };
  if (overrides) {
    return deepMerge(base, overrides);
  }
  return base;
}

function createReviewState(overrides) {
  const now = new Date().toISOString();
  const base = {
    $schema: 'orchestration-state-v3',
    project: { name: 'TEST', created: now, updated: now },
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
      current_step: 'master_plan',
    },
    execution: {
      status: 'complete',
      current_tier: 'review',
      current_phase: 0,
      total_phases: 1,
      phases: [{
        name: 'Phase 1',
        status: 'complete',
        current_task: 1,
        total_tasks: 1,
        tasks: [{ name: 'T01', status: 'complete', handoff_doc: 'h.md', report_doc: 'r.md', review_doc: 'rv.md', review_verdict: 'approved', review_action: 'advanced', has_deviations: false, deviation_type: null, retries: 0, report_status: 'complete' }],
        phase_plan_doc: 'pp.md',
        phase_report_doc: 'pr.md',
        phase_review_doc: 'prv.md',
        phase_review_verdict: 'approved',
        phase_review_action: 'advanced',
      }],
    },
  };
  if (overrides) {
    return deepMerge(base, overrides);
  }
  return base;
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
