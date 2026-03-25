'use strict';

// ─── Deep Clone ─────────────────────────────────────────────────────────────

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ─── Default Config ─────────────────────────────────────────────────────────

function createDefaultConfig() {
  return {
    version: '5.0',
    projects: { base_path: 'custom/project-store', naming: 'SCREAMING_CASE' },
    limits: {
      max_phases: 10,
      max_tasks_per_phase: 8,
      max_retries_per_task: 2,
      max_consecutive_review_rejections: 3,
    },
    human_gates: { after_planning: true, execution_mode: 'autonomous', after_final_review: true },
    source_control: {
      isolation_mode: 'none',
      activation: 'never',
      branch_from: 'ask',
      worktree_path: '../worktrees',
      branch_prefix: 'project/',
      cleanup: 'ask',
    },
  };
}

// ─── Mock IO ────────────────────────────────────────────────────────────────

function createMockIO({
  state = null,
  documents = {},
  config = null,
  createWorktree: createWorktreeOverride = null,
  removeWorktree: removeWorktreeOverride = null,
  hasUncommittedChanges: hasUncommittedChangesOverride = null,
  getDefaultBranch: getDefaultBranchOverride = null,
  getCurrentBranch: getCurrentBranchOverride = null,
  formatBranchName: formatBranchNameOverride = null,
} = {}) {
  const initialState = state !== null ? deepClone(state) : null;
  let currentState = initialState !== null ? deepClone(initialState) : null;
  const writes = [];
  let ensureDirsCalled = 0;
  const effectiveConfig = config !== null ? deepClone(config) : createDefaultConfig();
  const createWorktreeCalls = [];
  const removeWorktreeCalls = [];

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
    createWorktree(repoRoot, worktreePath, branchName, startPoint) {
      createWorktreeCalls.push({ repoRoot, worktreePath, branchName, startPoint });
      if (createWorktreeOverride !== null) {
        return createWorktreeOverride(repoRoot, worktreePath, branchName, startPoint);
      }
      return { success: true, output: '' };
    },
    removeWorktree(repoRoot, worktreePath, branchName) {
      removeWorktreeCalls.push({ repoRoot, worktreePath, branchName });
      if (removeWorktreeOverride !== null) {
        return removeWorktreeOverride(repoRoot, worktreePath, branchName);
      }
      return { success: true, output: '' };
    },
    hasUncommittedChanges(workingDir) {
      if (hasUncommittedChangesOverride !== null) {
        return hasUncommittedChangesOverride(workingDir);
      }
      return false;
    },
    getDefaultBranch(repoRoot) {
      if (getDefaultBranchOverride !== null) {
        return getDefaultBranchOverride(repoRoot);
      }
      return 'main';
    },
    getCurrentBranch(repoRoot) {
      if (getCurrentBranchOverride !== null) {
        return getCurrentBranchOverride(repoRoot);
      }
      return 'main';
    },
    formatBranchName(prefix, projectName) {
      if (formatBranchNameOverride !== null) {
        return formatBranchNameOverride(prefix, projectName);
      }
      return prefix + projectName.toLowerCase();
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
    getCreateWorktreeCalls() {
      return createWorktreeCalls;
    },
    getRemoveWorktreeCalls() {
      return removeWorktreeCalls;
    },
  };
}

// ─── State Factories ────────────────────────────────────────────────────────

function createBaseState(overrides) {
  const now = new Date().toISOString();
  const base = {
    $schema: 'orchestration-state-v5',
    project: { name: 'TEST', created: now, updated: now },
    pipeline: {
      current_tier: 'planning',
      source_control: {
        activation_choice: null,
        branch_from_choice: null,
        worktree_path: null,
        branch: null,
        cleanup_choice: null,
      },
    },
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
  if (overrides) {
    return deepMerge(base, overrides);
  }
  return base;
}

function createExecutionState(overrides) {
  const now = new Date().toISOString();
  const base = {
    $schema: 'orchestration-state-v5',
    project: { name: 'TEST', created: now, updated: now },
    pipeline: {
      current_tier: 'execution',
      gate_mode: 'autonomous',
      source_control: {
        activation_choice: null,
        branch_from_choice: null,
        worktree_path: null,
        branch: null,
        cleanup_choice: null,
      },
    },
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
            docs: { handoff: null, report: null, review: null },
            review: { verdict: null, action: null },
            report_status: null,
            has_deviations: false,
            deviation_type: null,
            retries: 0,
          },
          {
            name: 'T02',
            status: 'not_started',
            stage: 'planning',
            docs: { handoff: null, report: null, review: null },
            review: { verdict: null, action: null },
            report_status: null,
            has_deviations: false,
            deviation_type: null,
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
  if (overrides) {
    return deepMerge(base, overrides);
  }
  return base;
}

function createReviewState(overrides) {
  const now = new Date().toISOString();
  const base = {
    $schema: 'orchestration-state-v5',
    project: { name: 'TEST', created: now, updated: now },
    pipeline: {
      current_tier: 'review',
      source_control: {
        activation_choice: null,
        branch_from_choice: null,
        worktree_path: null,
        branch: null,
        cleanup_choice: null,
      },
    },
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
          docs: { handoff: 'h.md', report: 'r.md', review: 'rv.md' },
          review: { verdict: 'approved', action: 'advanced' },
          report_status: 'complete',
          has_deviations: false,
          deviation_type: null,
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
  if (overrides) {
    return deepMerge(base, overrides);
  }
  return base;
}

function createBaseStateV5(overrides) {
  const now = new Date().toISOString();
  const base = {
    $schema: 'orchestration-state-v5',
    project: { name: 'TEST', created: now, updated: now },
    pipeline: {
      current_tier: 'planning',
      source_control: {
        activation_choice: null,
        branch_from_choice: null,
        worktree_path: null,
        branch: null,
        cleanup_choice: null,
      },
    },
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
  createBaseStateV5,
  processAndAssert,
  deepClone,
};
