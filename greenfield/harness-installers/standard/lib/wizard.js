// greenfield/harness-installers/standard/lib/wizard.js — Interactive wizard
// orchestrator. Single-select harness per run; install OR uninstall.
//
// Two-step picker:
//   1. If the registry has at least one entry AND we're not headless AND
//      caller didn't force an action via `forceAction`, ask whether the user
//      wants to install or uninstall.
//   2. Then a sub-picker:
//        install   — three-variant single-select (today's behavior).
//        uninstall — single-select over currently-installed harnesses only.
//
// Confirmation:
//   install   — explicit Y/N (default No) only when the pick would overwrite
//               another variant's on-disk files OR downgrade the same variant.
//   uninstall — explicit Y/N (default No) every time, in yellow, listing
//               what gets removed and what's preserved.
//
// Returns `{ action, harnesses, skipConfirmation }` where action is 'install'
// or 'uninstall' and harnesses is always length 1.

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
 * Folder-presence probe used only by the headless `--yes` fallback path.
 * Today returns `['claude']` when `~/.claude/` exists. The interactive picker
 * no longer auto-pre-checks based on this — the user must explicitly select.
 *
 * `~/.copilot/` is intentionally NOT consulted: that directory is created by
 * Copilot tooling regardless of whether any rad-installed Copilot harness is
 * present, so its existence is not a meaningful install signal.
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

function buildInstallChoices() {
  return HARNESS_CHOICES.map(({ value, name }) => ({ value, name }));
}

function buildUninstallChoices(harnesses) {
  return Object.keys(harnesses)
    .sort()
    .map((key) => ({ value: key, name: HARNESS_DISPLAY_NAME[key] ?? key }));
}

/**
 * Renders the "Currently installed" block above the picker.
 * @param {Record<string, { version: string }>} harnesses
 */
function renderInstalledSummary(harnesses) {
  const entries = Object.entries(harnesses);
  if (entries.length === 0) {
    console.log(`  ${THEME.hint('No harnesses currently installed.')}`);
    return;
  }
  const rows = entries
    .map(([key, entry]) => ({
      name: HARNESS_DISPLAY_NAME[key] ?? key,
      version: entry.version,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const nameCol = Math.max(...rows.map((r) => r.name.length)) + 4;

  console.log(`  ${THEME.label('Currently installed')}`);
  console.log('');
  for (const r of rows) {
    console.log(`    ${THEME.body(r.name.padEnd(nameCol, ' '))}${THEME.secondary('v' + r.version)}`);
  }
}

/**
 * Returns the install destructive-confirmation message as an array of
 * pre-wrapped lines (for clean rendering above the `Continue?` prompt) or
 * null if no confirmation is needed.
 *
 * @param {Record<string, { version: string }>} harnesses
 * @param {string} pick
 * @param {string} deliveringVersion
 * @returns {string[] | null}
 */
function installDestructivePromptLines(harnesses, pick, deliveringVersion) {
  const conflicts = detectFolderConflicts(harnesses, pick);
  if (conflicts.length > 0) {
    const newUi = COPILOT_UI_LABEL[pick];
    const oldUi = COPILOT_UI_LABEL[conflicts[0].key];
    const partnerSummary = conflicts
      .map((c) => `${HARNESS_DISPLAY_NAME[c.key]} (v${c.entry.version})`)
      .join(' and ');
    return [
      `Installing ${HARNESS_DISPLAY_NAME[pick]} will replace your existing ${partnerSummary}.`,
      '',
      `Agents will model-route correctly in ${newUi} after the switch, but no`,
      `longer in ${oldUi} — ${oldUi} will run every agent on its main-chat model.`,
    ];
  }
  const same = harnesses[pick];
  if (same && cmpSemver(deliveringVersion, same.version) < 0) {
    return [
      `Installing v${deliveringVersion} will downgrade ${HARNESS_DISPLAY_NAME[pick]} from v${same.version}.`,
    ];
  }
  return null;
}

/**
 * Returns the uninstall confirmation lines: spelled-out "Will remove" and
 * "Will keep" blocks. Always renders for uninstall — uninstall is intrinsically
 * destructive, so there's no "skip if non-destructive" case.
 *
 * @param {string} pick
 * @param {{ root: string }} paths
 */
function uninstallPromptLines(pick) {
  const installRootForPick = (() => {
    if (pick === 'claude' || pick === 'claude-plugin') return path.join(os.homedir(), '.claude');
    return path.join(os.homedir(), '.copilot');
  })();
  return [
    `Uninstalling '${pick}'.`,
    '',
    'Will remove:',
    `    Agent and skill files under ${installRootForPick}`,
    `    The '${pick}' entry from ~/.radorch/install.json`,
    '',
    'Will keep:',
    '    ~/.radorch/orchestration.yml, templates/, projects/, ui/',
    '    Any other harnesses you have installed',
    `    Any files in ${installRootForPick} you created yourself`,
  ];
}

/**
 * Runs the wizard.
 *
 * @param {{
 *   skipConfirmation: boolean,
 *   cliOverrides?: { harnesses?: string[] } & Record<string, unknown>,
 *   homeDir?: string,
 *   deliveringVersion?: string,
 *   forceAction?: 'install' | 'uninstall',
 * }} options
 * @returns {Promise<{ action: 'install' | 'uninstall', harnesses: string[], skipConfirmation: boolean }>}
 */
export async function runWizard({
  skipConfirmation,
  cliOverrides = {},
  homeDir,
  deliveringVersion,
  forceAction,
}) {
  const paths = userDataPaths(homeDir ? { home: homeDir } : {});
  const registry = loadRegistry(paths.installJson);
  const harnesses = registry.harnesses ?? {};
  const installedCount = Object.keys(harnesses).length;

  // ─── Headless path ─────────────────────────────────────────────────────
  if (cliOverrides.harnesses !== undefined && cliOverrides.harnesses.length > 0) {
    const pick = cliOverrides.harnesses[0];
    const action = forceAction ?? 'install';

    if (action === 'uninstall' && !harnesses[pick]) {
      const err = new Error(`Cannot uninstall '${pick}' — not currently installed.`);
      err.code = 'NOT_INSTALLED';
      throw err;
    }

    if (!skipConfirmation) {
      if (action === 'install' && deliveringVersion) {
        await maybeConfirmInstallDestructive(harnesses, pick, deliveringVersion);
      } else if (action === 'uninstall') {
        await confirmUninstall(pick);
      }
    }
    return { action, harnesses: [pick], skipConfirmation };
  }

  if (skipConfirmation) {
    // Defensive: index.js rejects `--yes` without `--harness` before we run.
    return { action: forceAction ?? 'install', harnesses: ['claude'], skipConfirmation };
  }

  // ─── Interactive path ──────────────────────────────────────────────────
  console.log('');
  sectionHeader('::', 'Harness Installer');
  console.log('');
  renderInstalledSummary(harnesses);
  console.log('');

  // Step 1 — action picker. Only fires when the user has at least one
  // harness installed AND the caller didn't already force an action.
  let action;
  if (forceAction) {
    action = forceAction;
    if (action === 'uninstall' && installedCount === 0) {
      const err = new Error('No harnesses are installed. Nothing to uninstall.');
      err.code = 'NOTHING_TO_UNINSTALL';
      throw err;
    }
  } else if (installedCount > 0) {
    action = await select({
      message: 'What would you like to do?',
      theme: INQUIRER_THEME,
      choices: [
        { value: 'install',   name: 'Install or reinstall a harness' },
        { value: 'uninstall', name: 'Uninstall a harness' },
      ],
    });
  } else {
    action = 'install';
  }

  // Step 2 — harness picker.
  let pick;
  if (action === 'install') {
    pick = await select({
      message: 'Which harness do you want to install?',
      theme: INQUIRER_THEME,
      choices: buildInstallChoices(),
    });
    if (deliveringVersion) {
      await maybeConfirmInstallDestructive(harnesses, pick, deliveringVersion);
    }
  } else {
    pick = await select({
      message: 'Which harness do you want to uninstall?',
      theme: INQUIRER_THEME,
      choices: buildUninstallChoices(harnesses),
    });
    await confirmUninstall(pick);
  }

  return { action, harnesses: [pick], skipConfirmation };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function maybeConfirmInstallDestructive(harnesses, pick, deliveringVersion) {
  const lines = installDestructivePromptLines(harnesses, pick, deliveringVersion);
  if (!lines) return;
  console.log('');
  for (const line of lines) {
    console.log(`  ${THEME.warning ? THEME.warning(line) : line}`);
  }
  console.log('');
  const proceed = await confirm({
    message: 'Continue?',
    theme: INQUIRER_THEME,
    default: false,
  });
  if (!proceed) {
    const err = new Error('Install cancelled at confirmation prompt.');
    err.code = 'CANCELLED_AT_CONFIRM';
    throw err;
  }
}

async function confirmUninstall(pick) {
  const lines = uninstallPromptLines(pick);
  console.log('');
  for (const line of lines) {
    console.log(`  ${THEME.warning ? THEME.warning(line) : line}`);
  }
  console.log('');
  const proceed = await confirm({
    message: 'Continue?',
    theme: INQUIRER_THEME,
    default: false,
  });
  if (!proceed) {
    const err = new Error('Uninstall cancelled at confirmation prompt.');
    err.code = 'CANCELLED_AT_CONFIRM';
    throw err;
  }
}
