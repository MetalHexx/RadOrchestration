// harness-installers/standard/lib/wizard.js — Interactive wizard
// orchestrator. Single-select harness per run; install OR uninstall.
//
// Two-step picker:
//   1. If the registry has at least one entry AND we're not headless AND
//      caller didn't force an action via `forceAction`, ask whether the user
//      wants to install or uninstall. The "Uninstall a harness" option is
//      only offered when at least one *standard* harness is installed —
//      registries that contain only plugin entries skip the uninstall path
//      entirely (see below).
//   2. Then a sub-picker:
//        install   — three-variant single-select (today's behavior).
//        uninstall — single-select over currently-installed *standard*
//                    harnesses only. Plugin install-keys
//                    (`claude-plugin`, `copilot-cli-plugin`,
//                    `copilot-vscode-plugin`) are excluded — the standard
//                    installer does not own plugin lifecycle. Plugin entries
//                    in install.json are informational; manage plugins via
//                    `/plugin install`/`uninstall` in the harness, at the
//                    scope they were installed (user / project / system).
//                    The headless `--uninstall --harness <plugin-key>` path
//                    refuses with `PLUGIN_NOT_UNINSTALLABLE_HERE`.
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
import { loadRegistry, detectFolderConflicts, detectPluginCoexistence, cmpSemver } from './install/install-json.js';

const HARNESS_CHOICES = [
  { value: 'claude',         name: 'Claude Code' },
  { value: 'copilot-vscode', name: 'GitHub Copilot (VS Code)' },
  { value: 'copilot-cli',    name: 'GitHub Copilot CLI' },
];

// Install-keys written into install.json by the *plugin* installers (not the
// standard installer). The standard installer never owns these — plugin
// lifecycle lives entirely inside the harness via `/plugin install/uninstall`.
// These keys are filtered out of the uninstall picker and rejected in the
// headless `--uninstall` path.
const PLUGIN_INSTALL_KEYS = new Set([
  'claude-plugin',
  'copilot-cli-plugin',
  'copilot-vscode-plugin',
]);

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

const EXIT_VALUE = '__exit__';

function buildInstallChoices({ withCancel } = {}) {
  const choices = HARNESS_CHOICES.map(({ value, name }) => ({ value, name }));
  if (withCancel) {
    choices.push({ value: EXIT_VALUE, name: 'Cancel' });
  }
  return choices;
}

export function buildUninstallChoices(harnesses) {
  return Object.keys(harnesses)
    .filter((key) => !PLUGIN_INSTALL_KEYS.has(key))
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

  if (entries.some(([key]) => PLUGIN_INSTALL_KEYS.has(key))) {
    console.log('');
    console.log(`  ${THEME.hint('Plugin entries are informational — manage plugins via `/plugin install`/`uninstall` in your harness.')}`);
  }
}

/**
 * Returns the install destructive-confirmation message as an array of
 * pre-wrapped lines (for clean rendering above the `Continue?` prompt) or
 * null if no confirmation is needed.
 *
 * Three independent trigger blocks compose the prompt body, concatenated in
 * order with blank-line separators when more than one fires:
 *   1. Folder-mutex (legacy↔legacy) — partner will be evicted.
 *   2. Plugin coexistence — plugin partner shares the harness folder; its
 *      registry entry will be preserved but its files on disk will be
 *      overwritten by the legacy install.
 *   3. Downgrade — installing an older version of the same harness.
 *
 * @param {Record<string, { version: string }>} harnesses
 * @param {string} pick
 * @param {string} deliveringVersion
 * @returns {string[] | null}
 */
export function installDestructivePromptLines(harnesses, pick, deliveringVersion, opts = {}) {
  const blocks = [];

  // Block 1 — folder-mutex (legacy↔legacy only).
  const conflicts = detectFolderConflicts(harnesses, pick);
  if (conflicts.length > 0) {
    const newUi = COPILOT_UI_LABEL[pick];
    const oldUi = COPILOT_UI_LABEL[conflicts[0].key];
    const partnerSummary = conflicts
      .map((c) => `${HARNESS_DISPLAY_NAME[c.key]} (v${c.entry.version})`)
      .join(' and ');
    blocks.push([
      `Installing ${HARNESS_DISPLAY_NAME[pick]} will replace your existing ${partnerSummary}.`,
      '',
      `Agents will model-route correctly in ${newUi} after the switch, but no`,
      `longer in ${oldUi} — ${oldUi} will run every agent on its main-chat model.`,
    ]);
  }

  // Block 2 — plugin coexistence (registry OR disk).
  const coexist = detectPluginCoexistence(harnesses, pick, opts);
  if (coexist.length > 0) {
    const ui = HARNESS_DISPLAY_NAME[pick];
    const lines = [];
    for (const { partner, source, entry } of coexist) {
      const partnerName = HARNESS_DISPLAY_NAME[partner] ?? partner;
      const versionSuffix = entry ? ` (v${entry.version})` : '';
      const sourceTag = source === 'disk' ? ' detected on disk' : '';
      lines.push(`A ${partnerName}${versionSuffix} install is already present${sourceTag}.`);
    }
    lines.push('');
    lines.push(`Installing ${ui} will leave both channels' agents and skills on disk,`);
    lines.push(`so the harness will load DUPLICATE rad-orc:<name> entries for every`);
    lines.push(`shared agent and skill.`);
    lines.push('');
    lines.push(`To avoid duplicates, cancel and run \`/plugin uninstall rad-orc\` inside`);
    lines.push(`${ui} before re-installing the standard variant.`);
    blocks.push(lines);
  }

  // Block 3 — downgrade.
  const same = harnesses[pick];
  if (same && cmpSemver(deliveringVersion, same.version) < 0) {
    blocks.push([
      `Installing v${deliveringVersion} will downgrade ${HARNESS_DISPLAY_NAME[pick]} from v${same.version}.`,
    ]);
  }

  if (blocks.length === 0) return null;
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    if (i > 0) out.push('');
    out.push(...blocks[i]);
  }
  return out;
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
    `    The '${pick}' entry from ~/.radorc/install.json`,
    '',
    'Will keep:',
    '    ~/.radorc/orchestration.yml, templates/, projects/, ui/',
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
 * @returns {Promise<{ action: 'install' | 'uninstall' | 'exit', harnesses: string[], skipConfirmation: boolean }>}
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
  // Standard installer only owns non-plugin entries — plugin keys are
  // informational. The uninstall picker and the "Uninstall a harness"
  // action-picker option both gate on this narrower count.
  const standardInstalledCount = Object.keys(harnesses)
    .filter((key) => !PLUGIN_INSTALL_KEYS.has(key)).length;

  // ─── Headless path ─────────────────────────────────────────────────────
  if (cliOverrides.harnesses !== undefined && cliOverrides.harnesses.length > 0) {
    const pick = cliOverrides.harnesses[0];
    const action = forceAction ?? 'install';

    if (action === 'uninstall' && PLUGIN_INSTALL_KEYS.has(pick)) {
      const err = new Error(
        `'${pick}' is a harness plugin — uninstall it from inside the harness with ` +
        `\`/plugin uninstall rad-orc\` at the scope it was installed (user / project / system).`,
      );
      err.code = 'PLUGIN_NOT_UNINSTALLABLE_HERE';
      throw err;
    }

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
  // harness installed AND the caller didn't already force an action. The
  // Exit row gives a clean way to end the wizard loop.
  let action;
  let actionPickerShown = false;
  if (forceAction) {
    action = forceAction;
    if (action === 'uninstall' && standardInstalledCount === 0) {
      const err = new Error('No harnesses are installed. Nothing to uninstall.');
      err.code = 'NOTHING_TO_UNINSTALL';
      throw err;
    }
  } else if (installedCount > 0) {
    actionPickerShown = true;
    const actionChoices = [{ value: 'install', name: 'Install or reinstall a harness' }];
    if (standardInstalledCount > 0) {
      actionChoices.push({ value: 'uninstall', name: 'Uninstall a harness' });
    }
    actionChoices.push({ value: EXIT_VALUE, name: 'Exit' });
    action = await select({
      message: 'What would you like to do?',
      theme: INQUIRER_THEME,
      choices: actionChoices,
    });
    if (action === EXIT_VALUE) {
      return { action: 'exit', harnesses: [], skipConfirmation };
    }
  } else {
    action = 'install';
  }

  // Step 2 — harness picker. The install picker gains a 'Cancel' row only
  // when it's reached directly (registry empty AND no action picker shown);
  // otherwise the action picker's Exit row is the exit affordance and a
  // duplicate here would be confusing.
  let pick;
  if (action === 'install') {
    pick = await select({
      message: 'Which harness do you want to install?',
      theme: INQUIRER_THEME,
      choices: buildInstallChoices({ withCancel: !actionPickerShown }),
    });
    if (pick === EXIT_VALUE) {
      return { action: 'exit', harnesses: [], skipConfirmation };
    }
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
