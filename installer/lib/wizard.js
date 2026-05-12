// installer/lib/wizard.js — Interactive wizard orchestrator
//
// Surface order per DD-2:
//   1. Harness multi-select (claude / copilot-vscode / copilot-cli),
//      pre-checking entries auto-detected under the user's home directory.
//   2. Return canonical defaults unconditionally (FR-15, FR-16).

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { checkbox } from '@inquirer/prompts';
import { INQUIRER_THEME, THEME, sectionHeader } from './theme.js';

/**
 * Canonical defaults applied unconditionally by the wizard (FR-16).
 */
const CANONICAL = {
  defaultTemplate: 'ask',
  maxPhases: 10,
  maxTasksPerPhase: 8,
  maxRetriesPerTask: 5,
  maxConsecutiveReviewRejections: 3,
  humanGates: { afterPlanning: true, executionMode: 'ask', afterFinalReview: true },
  sourceControl: { autoCommit: 'ask', autoPr: 'ask' },
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
  const out = [];
  if (fs.existsSync(path.join(home, '.claude'))) out.push('claude');
  if (fs.existsSync(path.join(home, '.copilot'))) {
    // `.copilot` is the shared Copilot config root; surface both VS Code
    // and CLI as detected so the user can multi-select what's actually used.
    out.push('copilot-vscode');
    out.push('copilot-cli');
  }
  return out;
}

/**
 * Runs the wizard prompt sequence.
 *
 * Asks exactly the harness-checkbox question and returns the canonical defaults.
 * The Quick/Custom branch and all ten preference prompts are retired (FR-15, FR-20).
 *
 * @param {Object} options
 * @param {boolean} options.skipConfirmation - Whether to skip interactive prompts where possible
 * @param {Partial<Record<string, any>>} [options.cliOverrides] - CLI-provided values
 * @returns {Promise<Object>} The resolved config object with canonical defaults
 */
export async function runWizard({ skipConfirmation, cliOverrides = {} }) {
  // DD-2: surface order — harness selection first, then return canonical defaults.
  let harnesses;
  if (cliOverrides.harnesses !== undefined) {
    harnesses = cliOverrides.harnesses;
  } else if (skipConfirmation) {
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
      choices: HARNESS_CHOICES.map((c) => ({ ...c, checked: detected.has(c.value) })),
      validate: (s) => s.length > 0 || 'Select at least one harness.',
    });
  }

  return {
    harnesses,
    ...JSON.parse(JSON.stringify(CANONICAL)), // structural deep-clone
    skipConfirmation,
  };
}
