// greenfield/harness-installers/standard/lib/wizard.js — Interactive wizard
// orchestrator trimmed to AD-18: harness selection is the ONLY thing the
// wizard collects. The four review-intensity tier templates and the
// orchestration.yml that ships in runtime-config/ are deployed verbatim by
// `hydrateUserData`; the wizard does not collect any planning preference,
// tier choice, workspace root, or gate behavior (FR-15, FR-20, AD-18).
//
// Surface order per DD-2:
//   1. Harness multi-select (claude / copilot-vscode / copilot-cli),
//      pre-checking entries auto-detected under the user's home directory.
//   2. Return { harnesses, skipConfirmation } — no other fields.

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { checkbox } from '@inquirer/prompts';
import { INQUIRER_THEME, THEME, sectionHeader } from './theme.js';

const HARNESS_CHOICES = [
  { value: 'claude',         name: 'Claude Code' },
  { value: 'copilot-vscode', name: 'GitHub Copilot (VS Code)' },
  { value: 'copilot-cli',    name: 'GitHub Copilot CLI' },
];

/**
 * Probes a home directory for harness install hints.
 *   ~/.claude/  → claude
 *
 * Only `~/.claude/` is used as an auto-detect signal. `~/.copilot/` is NOT
 * checked: that directory is created by Copilot tooling regardless of which
 * variant (or any variant) the user actually uses, so its presence is not a
 * meaningful install signal. Copilot harnesses must be selected explicitly
 * — via the wizard checkbox (spacebar) or `--harness` flag — so users are
 * never opted into a Copilot install they didn't ask for.
 *
 * @param {{ homeDir?: string }} [opts]
 * @returns {string[]} subset of HARNESS_CHOICES values that look present
 */
export function detectInstalledHarnesses(opts = {}) {
  const home = opts.homeDir ?? os.homedir();
  const out = [];
  if (fs.existsSync(path.join(home, '.claude'))) out.push('claude');
  return out;
}

/**
 * Runs the wizard.
 *
 * Headless resolution order:
 *   1. `cliOverrides.harnesses` (explicit) wins unconditionally.
 *   2. Otherwise, when `skipConfirmation` is true, auto-detect from the home
 *      directory; if nothing detected, fall back to ['claude'] (FR-5).
 *   3. Otherwise (interactive), present the harness multi-select with
 *      auto-detected entries pre-checked (DD-2).
 *
 * @param {{
 *   skipConfirmation: boolean,
 *   cliOverrides?: { harnesses?: string[] } & Record<string, unknown>,
 *   homeDir?: string,
 * }} options
 * @returns {Promise<{ harnesses: string[], skipConfirmation: boolean }>}
 */
export async function runWizard({ skipConfirmation, cliOverrides = {}, homeDir }) {
  let harnesses;
  if (cliOverrides.harnesses !== undefined) {
    harnesses = cliOverrides.harnesses;
  } else if (skipConfirmation) {
    const detected = detectInstalledHarnesses({ homeDir });
    harnesses = detected.length > 0 ? detected : ['claude'];
  } else {
    console.log('');
    sectionHeader('::', 'Harnesses');
    console.log('');
    console.log(THEME.hint('  Which harnesses do you want radorch installed into?'));
    console.log('');
    const detected = new Set(detectInstalledHarnesses({ homeDir }));
    harnesses = await checkbox({
      message: 'Which harnesses do you want radorch installed into?',
      theme: INQUIRER_THEME,
      choices: HARNESS_CHOICES.map((c) => ({ ...c, checked: detected.has(c.value) })),
      validate: (s) => s.length > 0 || 'Select at least one harness.',
    });
  }

  return { harnesses, skipConfirmation };
}
