#!/usr/bin/env node
// greenfield/harness-installers/standard/index.js — CLI entry for the standard
// installer. Orchestrates the surface order spec'd by DD-2:
//
//   1. parseArgs → command + options
//   2. Early-return for help / version / uninstall (uninstall is a pointer
//      message only — FR-29, AD-18: actual deletion is owned by the bundled
//      CLI inside the harness).
//   3. renderBanner.
//   4. checkGit / checkGh → non-blocking warnings to stderr (FR-6, DD-4).
//   5. runWizard → harness selection (FR-4, FR-5).
//   6. Per-harness install loop, sequential, no rollback on per-harness
//      failure (AD-11). Each iteration is wrapped in an ora spinner (FR-7).
//   7. After the harness loop, hydrate ~/.radorch/ exactly once (FR-20 — the
//      runtime-config + templates are identical across per-harness payloads,
//      so any one harness's `dist/<h>` is a valid bundleRoot).
//   8. Compute drift hint by re-reading ~/.radorch/install.json (FR-9, AD-15).
//   9. renderPostInstallSummary → stdout (drift hint, if any, goes to stderr).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ora from 'ora';

// Presentation
import { renderBanner } from './lib/banner.js';
import { THEME, sectionHeader } from './lib/theme.js';

// CLI
import { parseArgs } from './lib/cli.js';
import { renderHelp } from './lib/help.js';

// Application
import { runWizard } from './lib/wizard.js';
import { renderPostInstallSummary } from './lib/summary.js';

// Install/upgrade orchestrator + user-data hydration (AD-1, AD-11, FR-20).
import { installHarness } from './lib/install/install-harness.js';
import { hydrateUserData } from './lib/install/hydrate-user-data.js';

// Install-time tooling checks (FR-6, AD-11).
import { checkGit, checkGh } from './lib/checks/tooling.js';

// Cross-channel drift detection (FR-9, AD-15).
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

  if (command === 'uninstall') {
    // FR-29, AD-18: the standard installer no longer owns deletion. The
    // bundled CLI inside the user's harness is the canonical entry point.
    console.log('Run /rad-ui-stop and then radorch uninstall from inside your harness.');
    return;
  }

  // Resolve where the bundled payloads live. When this file is shipped inside
  // the published tarball, `dist/<harness>/` sits next to index.js.
  // RADORCH_PACKAGE_ROOT env var allows tests to point at a synthetic fixture
  // without touching the real ~/.claude or ~/.radorch.
  const packageRoot = process.env.RADORCH_PACKAGE_ROOT ?? __dirname;
  const sharedRoot = path.join(packageRoot, 'dist');

  const skipConfirmation = options.skipConfirmation ?? false;

  try {
    renderBanner();

    const gitWarn = checkGit();
    if (gitWarn) process.stderr.write((THEME.warning ? THEME.warning(`⚠  ${gitWarn}`) : `⚠  ${gitWarn}`) + '\n');
    const ghWarn = checkGh();
    if (ghWarn) process.stderr.write((THEME.warning ? THEME.warning(`⚠  ${ghWarn}`) : `⚠  ${ghWarn}`) + '\n');

    const cfg = await runWizard({ skipConfirmation, cliOverrides: options });

    if (!Array.isArray(cfg.harnesses) || cfg.harnesses.length === 0) {
      throw new Error('Wizard returned no harnesses to install.');
    }

    console.log('');
    sectionHeader('::', 'Bootstrapping harnesses');
    console.log('');

    /** @type {import('./lib/summary.js').HarnessResult[]} */
    const harnessResults = [];

    // AD-11: sequential harness loop. Per-harness failures do NOT roll back
    // priors — they're logged and the loop continues so the rest of the
    // selected harnesses still install.
    for (const harness of cfg.harnesses) {
      const bundleRoot = path.join(packageRoot, 'dist', harness);
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
        // AD-11: continue to next harness — failures do not roll back priors.
        // 'failed' (not 'downgrade-refused') so summary distinguishes unexpected
        // exceptions from the install state machine's intentional refusal path.
        harnessResults.push({ harness, action: 'failed', message: err.message });
      }
    }

    // Hydrate ~/.radorch/ exactly once after the harness loop. The runtime
    // config and templates are identical across per-harness payloads (FR-20),
    // so the first harness's bundle is a valid source.
    const firstHarness = cfg.harnesses[0];
    await hydrateUserData({
      bundleRoot: path.join(packageRoot, 'dist', firstHarness),
      sharedRoot,
    });

    const configPath = path.join(os.homedir(), '.radorch', 'orchestration.yml');

    // FR-9, AD-15: compute drift from install.json — claude vs claude-plugin
    // entries diverging on version is the drift signal the summary surfaces.
    const driftHint = computeDriftHint();

    renderPostInstallSummary({
      harnessResults,
      configPath,
      driftHint,
      uiBuilt: true,
    });
  } catch (err) {
    if (err && err.name === 'ExitPromptError') {
      console.log('');
      process.exit(0);
      return;
    }
    console.error(THEME.error(`✖ Installation failed: ${err.message}`));
    process.exit(1);
  }
}

// Auto-invoke only when run directly (not when imported by tests). Use
// fs.realpathSync to resolve symlinks created by `npm link` / global installs.
const __scriptPath = fs.realpathSync(fileURLToPath(import.meta.url));
const __argvPath = process.argv[1] ? fs.realpathSync(process.argv[1]) : '';
if (__scriptPath === __argvPath) {
  main();
}
