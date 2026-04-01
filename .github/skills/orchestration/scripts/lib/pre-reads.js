'use strict';

const path = require('path');
const { readFile } = require('../validate/lib/utils/fs-helpers');

// ─── Helpers ────────────────────────────────────────────────────────────────

function success(context) { return { context, error: undefined }; }
function failure(error, event, field) {
  return { context: undefined, error: { error, event, field } };
}

function readOrFail(readDocument, docPath, event) {
  const doc = readDocument(docPath);
  if (!doc) return { ok: false, result: failure(`Document not found at '${docPath}'`, event) };
  return { ok: true, frontmatter: doc.frontmatter || {} };
}

function coerceNull(value) {
  if (value === 'null' || value === 'undefined') return null;
  return value;
}

// ─── Per-Event Handlers ─────────────────────────────────────────────────────

function handlePlanApproved(context, readDocument, projectDir) {
  let docPath = context.doc_path;

  if (!docPath) {
    // Derive doc_path from state.planning.steps[4] (master_plan step).
    // This step is always populated before plan_approved is ever signaled.
    const stateRaw = readFile(path.join(projectDir, 'state.json'));
    if (!stateRaw) {
      return failure(
        "Cannot derive master plan path: state.json unreadable at '" + projectDir + "'",
        'plan_approved',
        'doc_path',
      );
    }
    let state;
    try {
      state = JSON.parse(stateRaw);
    } catch (err) {
      return failure(
        'Cannot derive master plan path: state.json is not valid JSON',
        'plan_approved',
        'doc_path',
      );
    }
    const derived = state?.planning?.steps?.[4]?.doc_path;
    if (!derived) {
      return failure(
        'Cannot derive master plan path: state.planning.steps[4].doc_path is not set',
        'plan_approved',
        'doc_path',
      );
    }
    docPath = path.isAbsolute(derived) ? derived : path.join(projectDir, derived);
  }

  const { ok, frontmatter, result } = readOrFail(readDocument, docPath, 'plan_approved');
  if (!ok) return result;
  const n = frontmatter.total_phases;
  if (n === undefined || n === null) return failure('Missing required field', 'plan_approved', 'total_phases');
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) {
    return failure('Invalid value: total_phases must be a positive integer', 'plan_approved', 'total_phases');
  }
  return success({ ...context, total_phases: n });
}

function handleCodeReviewCompleted(context, readDocument) {
  const { ok, frontmatter, result } = readOrFail(readDocument, context.doc_path, 'code_review_completed');
  if (!ok) return result;
  const verdict = coerceNull(frontmatter.verdict);
  if (verdict === undefined || verdict === null) {
    return failure('Missing required field', 'code_review_completed', 'verdict');
  }
  return success({ ...context, verdict, review_doc_path: context.doc_path });
}

function handlePhasePlanCreated(context, readDocument) {
  const { ok, frontmatter, result } = readOrFail(readDocument, context.doc_path, 'phase_plan_created');
  if (!ok) return result;
  const { tasks, title } = frontmatter;
  if (tasks === undefined || tasks === null) return failure('Missing required field', 'phase_plan_created', 'tasks');
  if (!Array.isArray(tasks)) return failure('Invalid value: tasks must be an array', 'phase_plan_created', 'tasks');
  if (tasks.length === 0) return failure('Invalid value: tasks must be a non-empty array', 'phase_plan_created', 'tasks');
  return success({ ...context, tasks, title: title ?? null });
}

function handlePhaseReviewCompleted(context, readDocument) {
  const { ok, frontmatter, result } = readOrFail(readDocument, context.doc_path, 'phase_review_completed');
  if (!ok) return result;
  const verdict = coerceNull(frontmatter.verdict);
  if (verdict === undefined || verdict === null) {
    return failure('Missing required field', 'phase_review_completed', 'verdict');
  }
  if (frontmatter.exit_criteria_met === undefined || frontmatter.exit_criteria_met === null) {
    return failure('Missing required field', 'phase_review_completed', 'exit_criteria_met');
  }
  return success({ ...context, verdict, exit_criteria_met: frontmatter.exit_criteria_met, review_doc_path: context.doc_path });
}

// ─── Lookup Table ───────────────────────────────────────────────────────────

const PRE_READ_HANDLERS = {
  'plan_approved': handlePlanApproved,
  'task_completed': (context) => success(context),
  'code_review_completed': handleCodeReviewCompleted,
  'phase_plan_created': handlePhasePlanCreated,
  'phase_review_completed': handlePhaseReviewCompleted,
  'source_control_init': (context) => success(context),
  'task_commit_requested': (context) => success(context),
  'task_committed': (context) => success(context),
  'pr_requested': (context) => success(context),
  'pr_created':   (context) => success(context),
};

// ─── Entry Point ────────────────────────────────────────────────────────────

function preRead(event, context, readDocument, projectDir) {
  const handler = PRE_READ_HANDLERS[event];
  if (!handler) return success(context);
  return handler(context, readDocument, projectDir);
}

module.exports = { preRead };
