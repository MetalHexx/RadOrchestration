'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { SCHEMA_VERSION, SCHEMA_VERSION_V5, DAG_NODE_STATUSES } = require('./lib/constants.js');
const { loadTemplate } = require('./lib/dag-template-loader.js');
const _dagExpander = require('./lib/dag-expander.js');
const { expandPhases, expandTasks, computeExecutionOrder, injectCorrectiveTask } = _dagExpander;
const { validateTransition } = require('./lib/validator.js');

// ─── Default Config for Validation ──────────────────────────────────────────

const DEFAULT_CONFIG = {
  projects: { base_path: '.github/projects', naming: 'SCREAMING_CASE' },
  limits: {
    max_phases: 10,
    max_tasks_per_phase: 8,
    max_retries_per_task: 2,
    max_consecutive_review_rejections: 3,
  },
  human_gates: { after_planning: true, execution_mode: 'ask', after_final_review: true },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function pad2(n) {
  return String(n).padStart(2, '0');
}

function setNodeStatus(nodes, nodeId, status) {
  if (nodes[nodeId]) {
    nodes[nodeId].status = status;
  }
}

// ─── Version Detection ───────────────────────────────────────────────────────

/**
 * Detect state version from $schema field.
 * @param {Object} state - parsed state object
 * @returns {'v4' | 'v5' | 'unknown'}
 */
function detectVersion(state) {
  switch (state.$schema) {
    case SCHEMA_VERSION: return 'v4';
    case SCHEMA_VERSION_V5: return 'v5';
    default: return 'unknown';
  }
}

// ─── Planning Reconstruction ─────────────────────────────────────────────────

function markAllPlanningComplete(nodes) {
  for (const node of Object.values(nodes)) {
    if (node.planning_step) {
      node.status = DAG_NODE_STATUSES.COMPLETE;
    }
  }
  setNodeStatus(nodes, 'request_plan_approval', DAG_NODE_STATUSES.COMPLETE);
}

function reconstructPlanning(v4State, nodes) {
  const steps = v4State.planning.steps;

  for (const step of steps) {
    for (const node of Object.values(nodes)) {
      if (node.planning_step === step.name) {
        const STATUS_MAP = { complete: DAG_NODE_STATUSES.COMPLETE, in_progress: DAG_NODE_STATUSES.IN_PROGRESS, not_started: DAG_NODE_STATUSES.NOT_STARTED };
        node.status = STATUS_MAP[step.status] || step.status;
        break;
      }
    }
  }

  const gate = nodes.request_plan_approval;
  if (gate) {
    if (v4State.planning.human_approved) {
      gate.status = DAG_NODE_STATUSES.COMPLETE;
    } else {
      const allComplete = steps.every(s => s.status === 'complete');
      if (allComplete) {
        gate.status = DAG_NODE_STATUSES.IN_PROGRESS;
      }
      // otherwise stays not_started (default)
    }
  }
}

// ─── Task Stage Mapping ──────────────────────────────────────────────────────

function mapStageToNodes(nodes, handoffId, codeId, reviewId, stage) {
  switch (stage) {
    case 'planning':
      setNodeStatus(nodes, handoffId, DAG_NODE_STATUSES.IN_PROGRESS);
      break;
    case 'coding':
      setNodeStatus(nodes, handoffId, DAG_NODE_STATUSES.COMPLETE);
      setNodeStatus(nodes, codeId, DAG_NODE_STATUSES.IN_PROGRESS);
      break;
    case 'reviewing':
      setNodeStatus(nodes, handoffId, DAG_NODE_STATUSES.COMPLETE);
      setNodeStatus(nodes, codeId, DAG_NODE_STATUSES.COMPLETE);
      setNodeStatus(nodes, reviewId, DAG_NODE_STATUSES.IN_PROGRESS);
      break;
    case 'failed':
      setNodeStatus(nodes, handoffId, DAG_NODE_STATUSES.COMPLETE);
      setNodeStatus(nodes, codeId, DAG_NODE_STATUSES.COMPLETE);
      setNodeStatus(nodes, reviewId, DAG_NODE_STATUSES.FAILED);
      break;
  }
}

function mapTaskComplete(nodes, phaseNum, taskNum, task) {
  const prefix = `P${pad2(phaseNum)}.T${pad2(taskNum)}`;
  setNodeStatus(nodes, `${prefix}.create_task_handoff`, DAG_NODE_STATUSES.COMPLETE);
  setNodeStatus(nodes, `${prefix}.execute_coding_task`, DAG_NODE_STATUSES.COMPLETE);
  setNodeStatus(nodes, `${prefix}.code_review`, DAG_NODE_STATUSES.COMPLETE);
  setNodeStatus(nodes, `${prefix}.source_control_commit`, DAG_NODE_STATUSES.COMPLETE);

  if (task.retries > 0) {
    let lastReviewId = `${prefix}.code_review`;
    for (let r = 1; r <= task.retries; r++) {
      const newIds = injectCorrectiveTask(nodes, lastReviewId, phaseNum, taskNum, r);
      for (const id of newIds) {
        nodes[id].status = DAG_NODE_STATUSES.COMPLETE;
      }
      lastReviewId = newIds[2];
    }
  }
}

function mapTaskStage(nodes, phaseNum, taskNum, task) {
  const prefix = `P${pad2(phaseNum)}.T${pad2(taskNum)}`;
  const { stage, status, retries } = task;

  if (status === 'complete' && stage === 'complete') {
    mapTaskComplete(nodes, phaseNum, taskNum, task);
    return;
  }

  if (status === 'not_started') {
    return;
  }

  if (retries > 0) {
    // Original nodes complete (the review resulted in corrective)
    setNodeStatus(nodes, `${prefix}.create_task_handoff`, DAG_NODE_STATUSES.COMPLETE);
    setNodeStatus(nodes, `${prefix}.execute_coding_task`, DAG_NODE_STATUSES.COMPLETE);
    setNodeStatus(nodes, `${prefix}.code_review`, DAG_NODE_STATUSES.COMPLETE);

    let lastReviewId = `${prefix}.code_review`;
    for (let r = 1; r <= retries; r++) {
      const newIds = injectCorrectiveTask(nodes, lastReviewId, phaseNum, taskNum, r);
      lastReviewId = newIds[2];

      if (r < retries) {
        // Previous corrective cycles complete
        for (const id of newIds) {
          nodes[id].status = DAG_NODE_STATUSES.COMPLETE;
        }
      } else {
        // Current corrective cycle: map stage
        mapStageToNodes(nodes, newIds[0], newIds[1], newIds[2], stage);
      }
    }
    return;
  }

  // No retries — map stage directly
  mapStageToNodes(
    nodes,
    `${prefix}.create_task_handoff`,
    `${prefix}.execute_coding_task`,
    `${prefix}.code_review`,
    stage
  );
}

// ─── Phase Mapping ───────────────────────────────────────────────────────────

function markPhaseNodesComplete(nodes, phaseNum, phase) {
  const prefix = `P${pad2(phaseNum)}`;
  setNodeStatus(nodes, `${prefix}.create_phase_plan`, DAG_NODE_STATUSES.COMPLETE);
  setNodeStatus(nodes, `${prefix}.generate_phase_report`, DAG_NODE_STATUSES.COMPLETE);
  setNodeStatus(nodes, `${prefix}.phase_review`, DAG_NODE_STATUSES.COMPLETE);

  for (let t = 1; t <= phase.tasks.length; t++) {
    mapTaskComplete(nodes, phaseNum, t, phase.tasks[t - 1]);
  }
}

function mapPhaseStage(nodes, phaseNum, phase) {
  const prefix = `P${pad2(phaseNum)}`;

  switch (phase.stage) {
    case 'planning':
      setNodeStatus(nodes, `${prefix}.create_phase_plan`, DAG_NODE_STATUSES.IN_PROGRESS);
      break;
    case 'executing':
      setNodeStatus(nodes, `${prefix}.create_phase_plan`, DAG_NODE_STATUSES.COMPLETE);
      for (let t = 1; t <= phase.tasks.length; t++) {
        mapTaskStage(nodes, phaseNum, t, phase.tasks[t - 1]);
      }
      break;
    case 'reviewing':
      setNodeStatus(nodes, `${prefix}.create_phase_plan`, DAG_NODE_STATUSES.COMPLETE);
      for (let t = 1; t <= phase.tasks.length; t++) {
        mapTaskComplete(nodes, phaseNum, t, phase.tasks[t - 1]);
      }
      setNodeStatus(nodes, `${prefix}.generate_phase_report`, DAG_NODE_STATUSES.COMPLETE);
      setNodeStatus(nodes, `${prefix}.phase_review`, DAG_NODE_STATUSES.IN_PROGRESS);
      break;
    case 'complete':
      markPhaseNodesComplete(nodes, phaseNum, phase);
      break;
  }
}

// ─── Execution Reconstruction ────────────────────────────────────────────────

function reconstructExecution(v4State, nodes) {
  markAllPlanningComplete(nodes);

  const phases = v4State.execution.phases;
  if (phases.length === 0) return;

  expandPhases(nodes, 'for_each_phase', phases.length, phases);

  for (let p = 1; p <= phases.length; p++) {
    const phase = phases[p - 1];
    const prefix = `P${pad2(p)}`;

    if (phase.status === 'complete') {
      if (phase.tasks.length > 0) {
        expandTasks(nodes, `${prefix}.for_each_task`, p, phase.tasks);
      }
      markPhaseNodesComplete(nodes, p, phase);
    } else if (phase.status === 'in_progress' || phase.status === 'halted') {
      if (phase.tasks.length > 0) {
        expandTasks(nodes, `${prefix}.for_each_task`, p, phase.tasks);
      }
      mapPhaseStage(nodes, p, phase);
    }
    // Future phases (not_started): leave for_each_task as container, all not_started
  }
}

// ─── Review Reconstruction ───────────────────────────────────────────────────

function reconstructReview(v4State, nodes) {
  markAllPlanningComplete(nodes);

  const phases = v4State.execution.phases;
  if (phases.length > 0) {
    expandPhases(nodes, 'for_each_phase', phases.length, phases);
    for (let p = 1; p <= phases.length; p++) {
      const phase = phases[p - 1];
      if (phase.tasks.length > 0) {
        expandTasks(nodes, `P${pad2(p)}.for_each_task`, p, phase.tasks);
      }
      markPhaseNodesComplete(nodes, p, phase);
    }
  }

  const frStatus = v4State.final_review.status;
  if (frStatus === 'complete') {
    setNodeStatus(nodes, 'create_final_review', DAG_NODE_STATUSES.COMPLETE);
    if (v4State.pipeline.source_control && v4State.pipeline.source_control.pr_url) {
      setNodeStatus(nodes, 'invoke_source_control_pr', DAG_NODE_STATUSES.COMPLETE);
      if (v4State.final_review.human_approved) {
        setNodeStatus(nodes, 'request_final_approval', DAG_NODE_STATUSES.COMPLETE);
      } else {
        setNodeStatus(nodes, 'request_final_approval', DAG_NODE_STATUSES.IN_PROGRESS);
      }
    }
  } else if (frStatus === 'in_progress') {
    setNodeStatus(nodes, 'create_final_review', DAG_NODE_STATUSES.IN_PROGRESS);
  }
}

// ─── Complete Reconstruction ─────────────────────────────────────────────────

function reconstructComplete(v4State, nodes) {
  markAllPlanningComplete(nodes);

  const phases = v4State.execution.phases;
  if (phases.length > 0) {
    expandPhases(nodes, 'for_each_phase', phases.length, phases);
    for (let p = 1; p <= phases.length; p++) {
      const phase = phases[p - 1];
      if (phase.tasks.length > 0) {
        expandTasks(nodes, `P${pad2(p)}.for_each_task`, p, phase.tasks);
      }
      markPhaseNodesComplete(nodes, p, phase);
    }
  }

  setNodeStatus(nodes, 'create_final_review', DAG_NODE_STATUSES.COMPLETE);
  setNodeStatus(nodes, 'invoke_source_control_pr', DAG_NODE_STATUSES.COMPLETE);
  setNodeStatus(nodes, 'request_final_approval', DAG_NODE_STATUSES.COMPLETE);
}

// ─── Halted Reconstruction ──────────────────────────────────────────────────

function reconstructHalted(v4State, nodes) {
  const execStatus = v4State.execution.status;

  if (execStatus === 'not_started') {
    reconstructPlanning(v4State, nodes);
  } else if (execStatus === 'complete') {
    reconstructReview(v4State, nodes);
  } else {
    reconstructExecution(v4State, nodes);
  }

  // Sweep: find the active node and mark it halted
  for (const node of Object.values(nodes)) {
    if (node.status === DAG_NODE_STATUSES.IN_PROGRESS) {
      node.status = DAG_NODE_STATUSES.HALTED;
      return;
    }
  }
  for (const node of Object.values(nodes)) {
    if (node.status === DAG_NODE_STATUSES.FAILED) {
      node.status = DAG_NODE_STATUSES.HALTED;
      return;
    }
  }
}

// ─── Main Reconstruction ─────────────────────────────────────────────────────

/**
 * Reconstruct DAG node statuses from v4 nested state.
 * @param {Object} v4State - existing v4 state
 * @param {Object.<string, Object>} nodes - expanded template nodes (cloned internally)
 * @returns {Object.<string, Object>} nodes with statuses populated
 */
function reconstructDagState(v4State, nodes) {
  const cloned = JSON.parse(JSON.stringify(nodes));
  const tier = v4State.pipeline.current_tier;

  switch (tier) {
    case 'planning':
      reconstructPlanning(v4State, cloned);
      break;
    case 'execution':
      reconstructExecution(v4State, cloned);
      break;
    case 'review':
      reconstructReview(v4State, cloned);
      break;
    case 'complete':
      reconstructComplete(v4State, cloned);
      break;
    case 'halted':
      reconstructHalted(v4State, cloned);
      break;
  }

  return cloned;
}

// ─── Config Builder ──────────────────────────────────────────────────────────

function buildConfig(v4State) {
  const src = v4State.config || {};
  return {
    limits: {
      max_phases: src.limits?.max_phases ?? 10,
      max_tasks_per_phase: src.limits?.max_tasks_per_phase ?? 8,
      max_retries_per_task: src.limits?.max_retries_per_task ?? 2,
      max_consecutive_review_rejections: src.limits?.max_consecutive_review_rejections ?? 3,
    },
    human_gates: {
      after_planning: src.human_gates?.after_planning ?? true,
      execution_mode: src.human_gates?.execution_mode ?? 'ask',
      after_final_review: src.human_gates?.after_final_review ?? true,
    },
  };
}

// ─── migrateToV5 ─────────────────────────────────────────────────────────────

/**
 * Build a v5 state object from a v4 state and expanded DAG.
 * Pure function — does not perform I/O.
 * @param {Object} v4State - parsed v4 state.json
 * @param {{ nodes: Object, execution_order: string[] }} expandedDag - expanded template
 * @returns {Object} valid v5 state object
 */
function migrateToV5(v4State, expandedDag) {
  const statusNodes = reconstructDagState(v4State, expandedDag.nodes);
  const execution_order = computeExecutionOrder(statusNodes);

  const v5 = {
    $schema: SCHEMA_VERSION_V5,
    project: {
      name: v4State.project.name,
      created: v4State.project.created,
      updated: v4State.project.updated,
    },
    pipeline: {
      current_tier: v4State.pipeline.current_tier,
      template: 'full',
    },
    planning: JSON.parse(JSON.stringify(v4State.planning)),
    execution: JSON.parse(JSON.stringify(v4State.execution)),
    final_review: JSON.parse(JSON.stringify(v4State.final_review)),
    config: buildConfig(v4State),
    dag: {
      template_name: 'full',
      nodes: statusNodes,
      execution_order,
    },
  };

  if (v4State.pipeline.gate_mode !== undefined) {
    v5.pipeline.gate_mode = v4State.pipeline.gate_mode;
  }
  if (v4State.pipeline.source_control !== undefined) {
    v5.pipeline.source_control = JSON.parse(JSON.stringify(v4State.pipeline.source_control));
  }

  return v5;
}

// ─── migrateProject ──────────────────────────────────────────────────────────

/**
 * Run migration on a single project directory.
 * Backs up original as state.v4.json.bak, validates and writes v5 output.
 * Idempotent — if state is already v5, returns success without modification.
 * @param {string} projectDir - absolute path to project directory
 * @returns {{ success: boolean, error: string | null }}
 */
function migrateProject(projectDir) {
  const stateFile = path.join(projectDir, 'state.json');
  let rawState;

  try {
    const content = fs.readFileSync(stateFile, 'utf8');
    rawState = JSON.parse(content);
  } catch (err) {
    return { success: false, error: `Failed to read state.json: ${err.message}` };
  }

  const version = detectVersion(rawState);
  if (version === 'v5') {
    return { success: true, error: null };
  }
  if (version === 'unknown') {
    return { success: false, error: `Unknown schema version: ${rawState.$schema}` };
  }

  // Load and expand "full" template
  const orchRoot = path.resolve(__dirname, '..', '..', '..');
  const { template, error: loadError } = loadTemplate('full', orchRoot);
  if (loadError) {
    return { success: false, error: `Failed to load template: ${loadError}` };
  }
  let expandedDag;
  try {
    expandedDag = _dagExpander.expandTemplate(template);
  } catch (err) {
    return { success: false, error: `Failed to expand template: ${err.message}` };
  }

  let migrated;
  try {
    migrated = migrateToV5(rawState, expandedDag);
  } catch (err) {
    return { success: false, error: `Migration failed: ${err.message}` };
  }

  // Validate migrated state
  const validationErrors = validateTransition(null, migrated, DEFAULT_CONFIG);
  if (validationErrors.length > 0) {
    return {
      success: false,
      error: validationErrors.map(e => `[${e.invariant}] ${e.field}: ${e.message}`).join('; '),
    };
  }

  // Backup original
  const backupFile = path.join(projectDir, 'state.v4.json.bak');
  try {
    fs.copyFileSync(stateFile, backupFile);
  } catch (err) {
    return { success: false, error: `Failed to create backup: ${err.message}` };
  }

  // Write migrated state
  try {
    fs.writeFileSync(stateFile, JSON.stringify(migrated, null, 2) + '\n', 'utf8');
  } catch (err) {
    return { success: false, error: `Failed to write migrated state: ${err.message}` };
  }

  return { success: true, error: null };
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv[0]) {
    const projectDir = path.resolve(argv[0]);
    console.log(`Migrating project at: ${projectDir}`);
    const result = migrateProject(projectDir);
    if (result.success) {
      console.log('Migration successful.');
    } else {
      console.error(`Migration failed: ${result.error}`);
      process.exit(1);
    }
  } else {
    console.log('Usage: node migrate-to-v5.js <project-dir>');
    console.log('  <project-dir>  Absolute path to project directory containing state.json');
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  detectVersion,
  reconstructDagState,
  migrateToV5,
  migrateProject,
};
