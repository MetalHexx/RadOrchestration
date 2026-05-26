#!/usr/bin/env node
// harness-installers/standard/index.js — CLI entry for the standard
// installer.
//
// Surface:
//   1. parseArgs → command + options (help, version, uninstall, run).
//   2. Early-return for help / version.
//   3. `uninstall` positional sets forceAction='uninstall' on the wizard.
//      `--yes` without `--harness` errors (no silent default).
//   4. renderBanner + tooling checks.
//   5. runWizard returns { action, harnesses, skipConfirmation }.
//   6. action === 'install' → install loop + hydrateUserData + install summary.
//      action === 'uninstall' → uninstall loop + uninstall summary.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ora from 'ora';

import { renderBanner } from './lib/banner.js';
import { THEME, sectionHeader } from './lib/theme.js';

import { parseArgs } from './lib/cli.js';
import { renderHelp } from './lib/help.js';

import { runWizard } from './lib/wizard.js';
import { renderPostInstallSummary, renderUninstallSummary } from './lib/summary.js';

import { installHarness } from './lib/install/install-harness.js';
import { uninstallHarness } from './lib/install/uninstall-harness.js';
import { hydrateUserData } from './lib/install/hydrate-user-data.js';
import { UiLockError } from './lib/install/ui-stop.js';
import { loadRegistry } from './lib/install/install-json.js';
import { userDataPaths } from './lib/install/user-data-paths.js';

import { checkGit, checkGh } from './lib/checks/tooling.js';

import { computeDriftHint } from './lib/drift-hint.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main installer flow. Exported for testability.
 * @returns {Promise<void>}
 */
export async function main() {
  const args = process.argv.slice(2);
  const { command, options } = parseArgs(args);

  if (command === 'help') {
    renderHelp();
    return;
  }

  if (command === 'version') {
    const pkgPath = path.join(__dirname, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log(pkg.version);
    return;
  }

  const packageRoot = process.env.RADORCH_PACKAGE_ROOT ?? __dirname;
  const sharedRoot = path.join(packageRoot, 'output');

  const skipConfirmation = options.skipConfirmation ?? false;
  const forceAction = command === 'uninstall' ? 'uninstall' : undefined;

  // `--yes` alone is a UX trap (would silently default to claude). Require
  // explicit --harness in headless mode for both install and uninstall.
  if (skipConfirmation && (!Array.isArray(options.harnesses) || options.harnesses.length === 0)) {
    const verb = forceAction === 'uninstall' ? 'uninstall' : 'install';
    console.error(
      THEME.error(`✖ --yes requires --harness <claude|copilot-vscode|copilot-cli>. Headless ${verb} will not pick a default for you.`),
    );
    process.exit(2);
    return;
  }

  const rootPkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  const deliveringVersion = rootPkg.version;

  try {
    renderBanner();

    const gitWarn = checkGit();
    if (gitWarn) process.stderr.write((THEME.warning ? THEME.warning(`⚠  ${gitWarn}`) : `⚠  ${gitWarn}`) + '\n');
    const ghWarn = checkGh();
    if (ghWarn) process.stderr.write((THEME.warning ? THEME.warning(`⚠  ${ghWarn}`) : `⚠  ${ghWarn}`) + '\n');

    if (skipConfirmation) {
      // Headless: one-shot. No looping.
      const cfg = await runWizard({ skipConfirmation, cliOverrides: options, deliveringVersion, forceAction });
      if (!Array.isArray(cfg.harnesses) || cfg.harnesses.length === 0) {
        throw new Error('Wizard returned no harnesses.');
      }
      if (cfg.action === 'uninstall') {
        await runUninstallFlow({ packageRoot, harness: cfg.harnesses[0] });
      } else {
        await runInstallFlow({ packageRoot, sharedRoot, harnesses: cfg.harnesses });
      }
      return;
    }

    // Interactive: loop the wizard until the user picks Exit.
    let firstIteration = true;
    while (true) {
      const cfg = await runWizard({
        skipConfirmation,
        cliOverrides: firstIteration ? options : {},
        deliveringVersion,
        forceAction: firstIteration ? forceAction : undefined,
      });
      if (cfg.action === 'exit') {
        console.log('');
        console.log(THEME.hint('Goodbye.'));
        break;
      }
      if (!Array.isArray(cfg.harnesses) || cfg.harnesses.length === 0) {
        throw new Error('Wizard returned no harnesses.');
      }
      if (cfg.action === 'uninstall') {
        await runUninstallFlow({ packageRoot, harness: cfg.harnesses[0] });
      } else {
        await runInstallFlow({ packageRoot, sharedRoot, harnesses: cfg.harnesses });
      }
      firstIteration = false;
    }
  } catch (err) {
    if (err && err.name === 'ExitPromptError') {
      console.log('');
      process.exit(0);
      return;
    }
    if (err && err.code === 'CANCELLED_AT_CONFIRM') {
      console.log('');
      console.log(THEME.hint('Cancelled.'));
      process.exit(0);
      return;
    }
    if (err && (err.code === 'NOT_INSTALLED' || err.code === 'NOTHING_TO_UNINSTALL')) {
      console.error(THEME.error(`✖ ${err.message}`));
      process.exit(1);
      return;
    }
    console.error(THEME.error(`✖ ${forceAction === 'uninstall' ? 'Uninstall' : 'Installation'} failed: ${err.message}`));
    process.exit(1);
  }
}

async function runInstallFlow({ packageRoot, sharedRoot, harnesses }) {
  console.log('');
  sectionHeader('::', 'Bootstrapping harnesses');
  console.log('');

  /** @type {import('./lib/summary.js').HarnessResult[]} */
  const harnessResults = [];

  for (const harness of harnesses) {
    const bundleRoot = path.join(packageRoot, 'output', harness);
    const spinner = ora({ text: `Bootstrapping '${harness}'…`, color: THEME.spinner }).start();
    try {
      const result = await installHarness({ bundleRoot, sharedRoot, harness });
      if (result.action === 'downgrade-refused') {
        spinner.fail(`Bootstrapping '${harness}' refused (${result.action})`);
        harnessResults.push({ harness, action: result.action, message: result.message });
      } else {
        spinner.succeed(`Bootstrapped '${harness}' (${result.action})`);
        harnessResults.push({ harness, action: result.action });
      }
    } catch (err) {
      spinner.fail(`Failed to bootstrap '${harness}': ${err.message}`);
      harnessResults.push({ harness, action: 'failed', message: err.message });
    }
  }

  const firstHarness = harnesses[0];
  let uiStopped = false;
  try {
    const hydrateResult = await hydrateUserData({
      bundleRoot: path.join(packageRoot, 'output', firstHarness),
      sharedRoot,
    });
    uiStopped = hydrateResult.uiStopped;
  } catch (err) {
    if (err instanceof UiLockError) {
      process.stderr.write(`\nERROR: ${err.message}\n`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const configPath = path.join(os.homedir(), '.radorc', 'orchestration.yml');
  const driftHint = computeDriftHint();

  renderPostInstallSummary({
    harnessResults,
    configPath,
    driftHint,
    uiBuilt: true,
    uiStopped,
  });
}

async function runUninstallFlow({ packageRoot, harness }) {
  console.log('');
  sectionHeader('::', 'Uninstalling');
  console.log('');

  const bundleRoot = path.join(packageRoot, 'output', harness);
  const spinner = ora({ text: `Uninstalling '${harness}'…`, color: THEME.spinner }).start();

  let result;
  try {
    result = await uninstallHarness({ bundleRoot, harness });
  } catch (err) {
    spinner.fail(`Uninstall of '${harness}' failed: ${err.message}`);
    throw err;
  }

  if (result.action === 'not-installed') {
    spinner.warn(`'${harness}' is not installed — nothing to do.`);
    return;
  }

  spinner.succeed(`Uninstalled '${harness}' (v${result.removedVersion})`);

  // Re-load the registry to surface what's left.
  const paths = userDataPaths();
  const registry = loadRegistry(paths.installJson);

  renderUninstallSummary({
    harness,
    removedVersion: result.removedVersion,
    removedCount: result.removedCount,
    prunedDirs: result.prunedDirs,
    remainingHarnesses: registry.harnesses ?? {},
    configPath: paths.orchestrationYml,
  });
}

const __scriptPath = fs.realpathSync(fileURLToPath(import.meta.url));
const __argvPath = process.argv[1] ? fs.realpathSync(process.argv[1]) : '';
if (__scriptPath === __argvPath) {
  main();
}
