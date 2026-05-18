// greenfield/harness-installers/standard/lib/wizard.js — Interactive wizard
// orchestrator. Selects exactly one harness per install run (AD-18).
//
// Surface order:
//   1. Single-select picker over the three installable harnesses, labelled
//      with current registry state (not installed / same variant present /
//      will REPLACE a cross-UI variant on disk).
//   2. If the pick would overwrite another variant's on-disk files OR
//      downgrade the same variant, prompt for an explicit Y/N (default No).
//   3. Return { harnesses: [<pick>], skipConfirmation } — the install loop
//      iterates this array (always length 1 from the picker).
//
// Headless behavior is in index.js, not here: `--harness <X> --yes` skips
// both prompts; `--harness <X>` alone skips only the picker and still
// applies the destructive-pick confirmation; `--yes` alone errors out at
// the CLI layer before this wizard runs.

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { select, confirm } from '@inquirer/prompts';
import { INQUIRER_THEME, THEME, sectionHeader } from './theme.js';
import { userDataPaths } from './install/user-data-paths.js';
import { loadRegistry, detectFolderConflicts, cmpSemver } from './install/install-json.js';

const HARNESS_CHOICES = [
  { value: 'claude',         name: 'Claude Code' },
  { value: 'copilot-vscode', name: 'GitHub Copilot (VS Code)' },
  { value: 'copilot-cli',    name: 'GitHub Copilot CLI' },
];

const HARNESS_DISPLAY_NAME = {
  'claude':                'Claude Code',
  'claude-plugin':         'Claude Code (plugin)',
  'copilot-vscode':        'Copilot VS Code',
  'copilot-vscode-plugin': 'Copilot VS Code (plugin)',
  'copilot-cli':           'Copilot CLI',
  'copilot-cli-plugin':    'Copilot CLI (plugin)',
};

const COPILOT_UI_LABEL = {
  'copilot-vscode':        'Copilot VS Code',
  'copilot-vscode-plugin': 'Copilot VS Code',
  'copilot-cli':           'Copilot CLI',
  'copilot-cli-plugin':    'Copilot CLI',
};

/**
 * Folder-presence probe used only by the headless `--yes` fallback path,
 * which today returns `['claude']` when `~/.claude/` exists (or as a final
 * default if not). The interactive picker no longer auto-pre-checks based
 * on this — the user must explicitly select.
 *
 * `~/.copilot/` is intentionally NOT consulted: that directory is created
 * by Copilot tooling regardless of whether the user uses any rad-installed
 * Copilot harness, so its presence is not a meaningful install signal.
 *
 * @param {{ homeDir?: string }} [opts]
 * @returns {string[]}
 */
export function detectInstalledHarnesses(opts = {}) {
  const home = opts.homeDir ?? os.homedir();
  const out = [];
  if (fs.existsSync(path.join(home, '.claude'))) out.push('claude');
  return out;
}

/**
 * Build the picker's row labels from the current registry state.
 *
 * @param {Record<string, { version: string }>} harnesses
 * @returns {Array<{ value: string, name: string }>}
 */
function buildChoices(harnesses) {
  return HARNESS_CHOICES.map(({ value, name }) => {
    const sameInstalled = harnesses[value];
    if (sameInstalled) {
      return { value, name: `${name} (currently installed v${sameInstalled.version} — will reinstall)` };
    }
    const conflicts = detectFolderConflicts(harnesses, value);
    if (conflicts.length > 0) {
      const partnerLabels = conflicts.map((c) => `${HARNESS_DISPLAY_NAME[c.key]} (v${c.entry.version})`).join(' and ');
      return { value, name: `${name} (will REPLACE ${partnerLabels})` };
    }
    return { value, name };
  });
}

/**
 * Returns the destructive-confirmation message for a pick, or null if no
 * confirmation is needed (fresh install, same-version reinstall, upgrade,
 * or same-UI different-channel coexistence).
 *
 * @param {Record<string, { version: string }>} harnesses
 * @param {string} pick
 * @param {string} deliveringVersion
 */
function destructivePromptMessage(harnesses, pick, deliveringVersion) {
  // Cross-UI mutex eviction (one or more partners present).
  const conflicts = detectFolderConflicts(harnesses, pick);
  if (conflicts.length > 0) {
    const newUi = COPILOT_UI_LABEL[pick];
    // All conflicts are the "other UI" by construction (FOLDER_MUTEX_PARTNERS
    // only crosses cli ↔ vscode), so the OLD-UI label is taken from the first.
    const oldUi = COPILOT_UI_LABEL[conflicts[0].key];
    const partnerSummary = conflicts.map((c) => `${HARNESS_DISPLAY_NAME[c.key]} (v${c.entry.version})`).join(' and ');
    return (
      `Installing ${HARNESS_DISPLAY_NAME[pick]} will replace your existing ${partnerSummary}. ` +
      `After the switch, agents will model-route correctly in ${newUi} but no longer in ${oldUi} — ` +
      `${oldUi} will run every agent on its main-chat model.`
    );
  }
  // Downgrade of the same variant.
  const same = harnesses[pick];
  if (same && cmpSemver(deliveringVersion, same.version) < 0) {
    return (
      `Installing v${deliveringVersion} will downgrade ${HARNESS_DISPLAY_NAME[pick]} from v${same.version}.`
    );
  }
  return null;
}

/**
 * Runs the wizard.
 *
 * Resolution order:
 *   1. `cliOverrides.harnesses` (explicit, length 1) wins; if the pick is
 *      destructive AND `skipConfirmation` is false, the confirm prompt
 *      still fires.
 *   2. Otherwise, when `skipConfirmation` is true with no `--harness`,
 *      this path is unreachable — index.js rejects that combination before
 *      calling runWizard. Defensive fallback returns ['claude'].
 *   3. Otherwise (interactive), present the single-select picker with
 *      state-aware labels; then fire a confirm prompt if the pick is
 *      destructive.
 *
 * @param {{
 *   skipConfirmation: boolean,
 *   cliOverrides?: { harnesses?: string[] } & Record<string, unknown>,
 *   homeDir?: string,
 *   deliveringVersion?: string,
 * }} options
 * @returns {Promise<{ harnesses: string[], skipConfirmation: boolean }>}
 */
export async function runWizard({ skipConfirmation, cliOverrides = {}, homeDir, deliveringVersion }) {
  const paths = userDataPaths(homeDir ? { home: homeDir } : {});
  const registry = loadRegistry(paths.installJson);
  const harnesses = registry.harnesses ?? {};

  let pick;
  if (cliOverrides.harnesses !== undefined && cliOverrides.harnesses.length > 0) {
    pick = cliOverrides.harnesses[0];
  } else if (skipConfirmation) {
    // Defensive: index.js rejects `--yes` without `--harness` before we run.
    pick = 'claude';
  } else {
    console.log('');
    sectionHeader('::', 'Harness');
    console.log('');
    console.log(THEME.hint('  Install the Copilot variant matching the UI you use most often —'));
    console.log(THEME.hint('  per-agent model routing works only in the variant whose agent files are on disk.'));
    console.log('');
    pick = await select({
      message: 'Which harness do you want to install?',
      theme: INQUIRER_THEME,
      choices: buildChoices(harnesses),
    });
  }

  if (!skipConfirmation && deliveringVersion) {
    const message = destructivePromptMessage(harnesses, pick, deliveringVersion);
    if (message) {
      const proceed = await confirm({
        message: `${message} Continue?`,
        theme: INQUIRER_THEME,
        default: false,
      });
      if (!proceed) {
        const err = new Error('Install cancelled at confirmation prompt.');
        err.code = 'CANCELLED_AT_CONFIRM';
        throw err;
      }
    }
  }

  return { harnesses: [pick], skipConfirmation };
}
