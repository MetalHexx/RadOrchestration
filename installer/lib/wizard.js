// installer/lib/wizard.js — Interactive wizard orchestrator
//
// Surface order:
//   1. Harness multi-select (claude / copilot-vscode / copilot-cli),
//      pre-checking entries auto-detected under the user's home directory.
//   2. Quick vs Custom branch.
//   3. Quick → canonical defaults (no further prompts).
//      Custom → ten preference prompts:
//        defaultTemplate, four pipeline limits, three human gates
//        (afterPlanning, executionMode, afterFinalReview),
//        two source-control modes (autoCommit, autoPr).

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { checkbox, select, confirm } from '@inquirer/prompts';
import { INQUIRER_THEME, THEME, sectionHeader } from './theme.js';
import { promptDefaultTemplate } from './prompts/default-template.js';
import { promptPipelineLimits } from './prompts/pipeline-limits.js';
import { promptGateBehavior } from './prompts/gate-behavior.js';
import { promptSourceControl } from './prompts/source-control.js';

/**
 * Canonical defaults applied by the Quick install path.
 * @type {{
 *   defaultTemplate: 'ask',
 *   maxPhases: number,
 *   maxTasksPerPhase: number,
 *   maxRetriesPerTask: number,
 *   maxConsecutiveReviewRejections: number,
 *   humanGates: { afterPlanning: boolean, executionMode: 'ask', afterFinalReview: boolean },
 *   sourceControl: { autoCommit: 'ask', autoPr: 'ask' },
 * }}
 */
const QUICK_DEFAULTS = {
  defaultTemplate: 'ask',
  maxPhases: 10,
  maxTasksPerPhase: 8,
  maxRetriesPerTask: 5,
  maxConsecutiveReviewRejections: 3,
  humanGates: {
    afterPlanning: true,
    executionMode: 'ask',
    afterFinalReview: true,
  },
  sourceControl: {
    autoCommit: 'ask',
    autoPr: 'ask',
  },
};

const HARNESS_CHOICES = [
  { value: 'claude',         name: 'Claude Code' },
  { value: 'copilot-vscode', name: 'GitHub Copilot (VS Code)' },
  { value: 'copilot-cli',    name: 'GitHub Copilot CLI' },
];

/**
 * Probes the user's home directory for harness install hints.
 * Currently checks `~/.claude` and `~/.copilot`.
 * @returns {string[]} subset of HARNESS_CHOICES values that look present
 */
export function detectInstalledHarnesses() {
  const home = os.homedir();
  const detected = [];
  if (fs.existsSync(path.join(home, '.claude'))) {
    detected.push('claude');
  }
  if (fs.existsSync(path.join(home, '.copilot'))) {
    // `.copilot` is the shared Copilot config root; surface both VS Code
    // and CLI as detected so the user can multi-select what's actually used.
    detected.push('copilot-vscode');
    detected.push('copilot-cli');
  }
  return detected;
}

/**
 * Runs the wizard prompt sequence.
 *
 * `cliOverrides.mode` ('quick' | 'custom') and `cliOverrides.harnesses`
 * skip the corresponding interactive prompts. Under `--yes` (skipConfirmation),
 * any prompt with a covering override is fully skipped; remaining values
 * fall back to the canonical Quick defaults.
 *
 * @param {Object} options
 * @param {boolean} options.skipConfirmation - Whether to skip interactive prompts where possible
 * @param {Partial<Record<string, any>>} [options.cliOverrides] - CLI-provided values
 * @returns {Promise<Object>} The resolved config object
 */
export async function runWizard({ skipConfirmation, cliOverrides = {} }) {
  const has = (/** @type {string} */ key) => cliOverrides[key] !== undefined;

  // ── Harness multi-select ────────────────────────────────────────────────
  let harnesses;
  if (has('harnesses')) {
    harnesses = cliOverrides.harnesses;
  } else if (skipConfirmation) {
    // Unattended fallback: auto-detected harnesses, or 'claude' if none detected.
    const detected = detectInstalledHarnesses();
    harnesses = detected.length > 0 ? detected : ['claude'];
  } else {
    console.log('');
    sectionHeader('::', 'Harnesses');
    console.log('');
    console.log(THEME.hint('  Which harnesses do you want radorch installed into?'));
    console.log('');
    const detected = new Set(detectInstalledHarnesses());
    harnesses = await checkbox({
      message: 'Which harnesses do you want radorch installed into?',
      theme: INQUIRER_THEME,
      choices: HARNESS_CHOICES.map((c) => ({
        ...c,
        checked: detected.has(c.value),
      })),
      validate: (selections) => selections.length > 0 || 'Select at least one harness.',
    });
  }

  // ── Quick vs Custom ─────────────────────────────────────────────────────
  let mode;
  if (has('mode')) {
    mode = cliOverrides.mode;
  } else if (skipConfirmation) {
    mode = 'quick';
  } else {
    console.log('');
    sectionHeader('::', 'Install Mode');
    console.log('');
    mode = await select({
      message: 'Quick install (recommended defaults) or Custom?',
      theme: INQUIRER_THEME,
      default: 'quick',
      choices: [
        { name: 'Quick — Recommended defaults',                   value: 'quick' },
        { name: 'Custom — Walk through every preference',         value: 'custom' },
      ],
    });
  }

  // ── Quick path: canonical defaults ──────────────────────────────────────
  if (mode === 'quick') {
    return {
      harnesses,
      mode,
      ...structuredCloneDefaults(QUICK_DEFAULTS),
      skipConfirmation,
    };
  }

  // ── Custom path: walk preferences ───────────────────────────────────────
  // defaultTemplate
  let defaultTemplate;
  if (has('defaultTemplate')) {
    defaultTemplate = cliOverrides.defaultTemplate;
  } else if (skipConfirmation) {
    defaultTemplate = QUICK_DEFAULTS.defaultTemplate;
  } else {
    console.log('');
    sectionHeader('::', 'Default Template');
    console.log('');
    ({ defaultTemplate } = await promptDefaultTemplate());
  }

  // Pipeline limits (four prompts collapsed into one prompt module).
  let maxPhases, maxTasksPerPhase, maxRetriesPerTask, maxConsecutiveReviewRejections;
  const limitsCovered = has('maxPhases') && has('maxTasksPerPhase')
    && has('maxRetriesPerTask') && has('maxConsecutiveReviewRejections');
  if (limitsCovered) {
    maxPhases = cliOverrides.maxPhases;
    maxTasksPerPhase = cliOverrides.maxTasksPerPhase;
    maxRetriesPerTask = cliOverrides.maxRetriesPerTask;
    maxConsecutiveReviewRejections = cliOverrides.maxConsecutiveReviewRejections;
  } else if (skipConfirmation) {
    maxPhases = cliOverrides.maxPhases ?? QUICK_DEFAULTS.maxPhases;
    maxTasksPerPhase = cliOverrides.maxTasksPerPhase ?? QUICK_DEFAULTS.maxTasksPerPhase;
    maxRetriesPerTask = cliOverrides.maxRetriesPerTask ?? QUICK_DEFAULTS.maxRetriesPerTask;
    maxConsecutiveReviewRejections = cliOverrides.maxConsecutiveReviewRejections
      ?? QUICK_DEFAULTS.maxConsecutiveReviewRejections;
  } else {
    console.log('');
    sectionHeader('::', 'Pipeline Limits');
    console.log('');
    ({
      maxPhases,
      maxTasksPerPhase,
      maxRetriesPerTask,
      maxConsecutiveReviewRejections,
    } = await promptPipelineLimits());
  }

  // Human gates: afterPlanning, executionMode, afterFinalReview.
  let afterPlanning, executionMode, afterFinalReview;
  if (has('afterPlanning')) {
    afterPlanning = cliOverrides.afterPlanning;
  } else if (skipConfirmation) {
    afterPlanning = QUICK_DEFAULTS.humanGates.afterPlanning;
  } else {
    afterPlanning = await confirm({
      message: 'Gate after planning (require human approval before execution)?',
      theme: INQUIRER_THEME,
      default: QUICK_DEFAULTS.humanGates.afterPlanning,
    });
  }

  if (has('executionMode')) {
    executionMode = cliOverrides.executionMode;
  } else if (skipConfirmation) {
    executionMode = QUICK_DEFAULTS.humanGates.executionMode;
  } else {
    console.log('');
    sectionHeader('::', 'Execution Mode');
    console.log('');
    ({ executionMode } = await promptGateBehavior());
  }

  if (has('afterFinalReview')) {
    afterFinalReview = cliOverrides.afterFinalReview;
  } else if (skipConfirmation) {
    afterFinalReview = QUICK_DEFAULTS.humanGates.afterFinalReview;
  } else {
    afterFinalReview = await confirm({
      message: 'Gate after final review (require human approval before commit/PR)?',
      theme: INQUIRER_THEME,
      default: QUICK_DEFAULTS.humanGates.afterFinalReview,
    });
  }

  // Source control: autoCommit, autoPr.
  let autoCommit, autoPr;
  const sourceCovered = has('autoCommit') && has('autoPr');
  if (sourceCovered) {
    autoCommit = cliOverrides.autoCommit;
    autoPr = cliOverrides.autoPr;
  } else if (skipConfirmation) {
    autoCommit = cliOverrides.autoCommit ?? QUICK_DEFAULTS.sourceControl.autoCommit;
    autoPr = cliOverrides.autoPr ?? QUICK_DEFAULTS.sourceControl.autoPr;
  } else {
    console.log('');
    sectionHeader('::', 'Source Control');
    console.log('');
    ({ autoCommit, autoPr } = await promptSourceControl());
  }

  return {
    harnesses,
    mode,
    defaultTemplate,
    maxPhases,
    maxTasksPerPhase,
    maxRetriesPerTask,
    maxConsecutiveReviewRejections,
    humanGates: {
      afterPlanning,
      executionMode,
      afterFinalReview,
    },
    sourceControl: {
      autoCommit,
      autoPr,
    },
    skipConfirmation,
  };
}

/**
 * Deep-clone the canonical defaults so callers cannot mutate the shared object.
 * Avoids structuredClone() to remain compatible with Node 18.
 */
function structuredCloneDefaults(d) {
  return {
    defaultTemplate: d.defaultTemplate,
    maxPhases: d.maxPhases,
    maxTasksPerPhase: d.maxTasksPerPhase,
    maxRetriesPerTask: d.maxRetriesPerTask,
    maxConsecutiveReviewRejections: d.maxConsecutiveReviewRejections,
    humanGates: { ...d.humanGates },
    sourceControl: { ...d.sourceControl },
  };
}
