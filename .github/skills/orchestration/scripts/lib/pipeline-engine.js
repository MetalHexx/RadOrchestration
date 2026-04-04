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

/**
 * Fire-and-forget RAG embedding. Never blocks pipeline. Logs to stderr.
 * @param {string[]} ragArgs - arguments for rag.js
 * @param {string} orchRoot - path to .github root
 */
function triggerEmbedding(ragArgs, orchRoot) {
  try {
    const { execFileSync } = require('child_process');
    const ragScript = path.join(orchRoot, 'skills', 'orchestration', 'scripts', 'rag.js');
    execFileSync('node', [ragScript, ...ragArgs], {
      stdio: ['pipe', 'pipe', 'inherit'], // stderr → parent stderr for warnings
      timeout: 120000, // 2 min max
    });
  } catch (err) {
    // RAG is optional — log and continue
    process.stderr.write(`[pipeline] RAG embedding failed (non-blocking): ${err.message}\n`);
  }
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
    knowledge_compilation: {
      status: 'not_started',
      doc_path: null,
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

  // ── RAG embedding triggers (fire-and-forget) ─────────────────────────
  const ragEnabled = config.rag && config.rag.enabled;
  if (ragEnabled) {
    const orchRoot = path.resolve(__dirname, '..', '..');

    // Trigger 1: Planning complete — embed all planning docs
    if (event === 'master_plan_completed') {
      const { discoverPlanningArtifacts } = require('./rag/phase-discovery');
      const artifacts = discoverPlanningArtifacts(proposed.state);
      for (const a of artifacts) {
        triggerEmbedding(['embed', '--doc', a.doc_path, '--project-dir', projectDir, '--table', 'context', '--doc-type', a.doc_type], orchRoot);
      }
      process.stderr.write(`[pipeline] RAG: embedded ${artifacts.length} planning docs\n`);
    }

    // Trigger 2: Phase complete — embed all phase artifacts
    if (event === 'phase_review_completed' && proposed.state.execution) {
      const phaseIdx = currentState.execution.current_phase; // 1-based
      const phase = proposed.state.execution.phases[phaseIdx - 1];
      if (phase && phase.stage === 'complete') {
        triggerEmbedding(['embed-phase', '--project-dir', projectDir, '--phase', String(phaseIdx)], orchRoot);
        process.stderr.write(`[pipeline] RAG: embedded phase ${phaseIdx} artifacts\n`);
      }
    }

    // Trigger 3: Knowledge compilation complete — embed knowledge doc into knowledge table
    if (event === 'knowledge_compilation_completed' && normalizedContext.doc_path) {
      triggerEmbedding([
        'embed',
        '--doc', normalizedContext.doc_path,
        '--project-dir', projectDir,
        '--table', 'knowledge',
        '--doc-type', 'project-knowledge',
      ], orchRoot);
      process.stderr.write(`[pipeline] RAG: embedded project knowledge doc\n`);
    }
  }

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
