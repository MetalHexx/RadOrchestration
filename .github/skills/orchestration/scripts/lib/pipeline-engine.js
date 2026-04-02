'use strict';

const path = require('path');

const { preRead }             = require('./pre-reads');
const { getMutation, normalizeDocPath } = require('./mutations');
const { validateTransition }  = require('./validator');
const { resolveNextAction }   = require('./resolver');
const { SCHEMA_VERSION }      = require('./constants');

// ─── Helpers ────────────────────────────────────────────────────────────────

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ─── scaffoldInitialState ───────────────────────────────────────────────────

/**
 * Create initial state for a new project.
 *
 * @param {Object} config - parsed orchestration config
 * @param {string} projectDir - absolute path to project directory
 * @returns {Object} fresh v4 state object
 */
function scaffoldInitialState(config, projectDir) {
  const now = new Date().toISOString();
  return {
    $schema: SCHEMA_VERSION,
    project: {
      name: path.basename(projectDir),
      created: now,
      updated: now,
    },
    pipeline: {
      current_tier: 'planning',
      gate_mode: null,
    },
    planning: {
      status: 'not_started',
      human_approved: false,
      steps: [
        { name: 'research',      status: 'not_started', doc_path: null },
        { name: 'prd',           status: 'not_started', doc_path: null },
        { name: 'design',        status: 'not_started', doc_path: null },
        { name: 'architecture',  status: 'not_started', doc_path: null },
        { name: 'master_plan',   status: 'not_started', doc_path: null },
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
    config: {
      limits: {
        max_phases:                        config.limits.max_phases,
        max_tasks_per_phase:               config.limits.max_tasks_per_phase,
        max_retries_per_task:              config.limits.max_retries_per_task,
        max_consecutive_review_rejections: config.limits.max_consecutive_review_rejections,
      },
      human_gates: {
        after_planning:     config.human_gates.after_planning,
        execution_mode:     config.human_gates.execution_mode,
        after_final_review: config.human_gates.after_final_review,
      },
    },
  };
}

// ─── handleInit ─────────────────────────────────────────────────────────────

function handleInit(config, projectDir, io) {
  io.ensureDirectories(projectDir);
  const initialState = scaffoldInitialState(config, projectDir);
  io.writeState(projectDir, initialState);
  const next = resolveNextAction(initialState, config);
  return {
    success: true,
    action: next.action,
    context: next.context,
    mutations_applied: ['project_initialized'],
  };
}

// ─── handleColdStart ────────────────────────────────────────────────────────

function handleColdStart(currentState, config) {
  const next = resolveNextAction(currentState, config);
  return {
    success: true,
    action: next.action,
    context: next.context,
    mutations_applied: [],
  };
}

// ─── processEvent ───────────────────────────────────────────────────────────

/**
 * Process a single pipeline event. Implements the linear recipe:
 * load → pre-read → mutate → validate → write → resolve → return.
 *
 * @param {string} event - pipeline event name
 * @param {string} projectDir - absolute path to project directory
 * @param {Object} context - event-specific context from Orchestrator
 * @param {Object} io - dependency-injected I/O
 * @param {string} [configPath] - path to orchestration.yml; auto-discovers if omitted
 * @returns {Object} PipelineResult
 */
function processEvent(event, projectDir, context, io, configPath) {
  const config = io.readConfig(configPath);
  const currentState = io.readState(projectDir);

  // Init path: no state + start event
  if (!currentState && event === 'start') {
    return handleInit(config, projectDir, io);
  }

  // Cold-start path: existing state + start event
  if (currentState && event === 'start') {
    return handleColdStart(currentState, config);
  }

  // No state + non-start event
  if (!currentState) {
    return {
      success: false,
      action: null,
      context: { error: 'No state.json found; use --event start to initialize' },
      mutations_applied: [],
    };
  }

  // ── Standard path ─────────────────────────────────────────────────────

  const preReadResult = preRead(event, context, io.readDocument, projectDir);
  if (preReadResult.error) {
    return {
      success: false,
      action: null,
      context: preReadResult.error,
      mutations_applied: [],
    };
  }

  const mutationFn = getMutation(event);
  if (!mutationFn) {
    return {
      success: false,
      action: null,
      context: { error: `Unknown event: ${event}` },
      mutations_applied: [],
    };
  }

  // ── Single-point doc_path normalization ──────────────────────────────
  const normalizedContext = { ...preReadResult.context };
  if (normalizedContext.doc_path) {
    normalizedContext.doc_path = normalizeDocPath(
      normalizedContext.doc_path,
      config.projects.base_path,
      path.basename(projectDir)
    );
  }

  const proposed = mutationFn(deepClone(currentState), normalizedContext, config);

  // ensure project.updated strictly advances before validation
  const now = new Date().toISOString();
  const prev = currentState.project.updated;
  proposed.state.project.updated = (prev && now <= prev)
    ? new Date(new Date(prev).getTime() + 1).toISOString()
    : now;

  const errors = validateTransition(currentState, proposed.state, config);
  if (errors.length > 0) {
    return {
      success: false,
      action: null,
      context: { error: 'State validation failed', violations: errors },
      mutations_applied: [],
    };
  }

  io.writeState(projectDir, proposed.state);

  const next = resolveNextAction(proposed.state, config);

  return {
    success: true,
    action: next.action,
    context: next.context,
    mutations_applied: proposed.mutations_applied,
  };
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = { processEvent, scaffoldInitialState };
