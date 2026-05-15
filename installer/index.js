#!/usr/bin/env node
// installer/index.js — Legacy `radorch` installer entry point.
//
// This installer routes every harness through the same `runPluginBootstrap`
// the Claude plugin SessionStart hook calls. The legacy CLI's job is now:
//
//   1. Run the wizard (interactive or --yes), producing a config that
//      describes the selected harnesses + user preferences.
//   2. For each selected harness: call `runPluginBootstrap` with the bundled
//      plugin payload at `installer/src/<harness>/`. The bootstrap library
//      writes harness-routed files to `~/<harness-dir>/` and ~/.radorch/.
//   3. Write `~/.radorch/orchestration.yml` from the wizard preferences.
//   4. Print the post-install summary.
//
// All workspace-relative install paths are retired (FR-1, FR-21). All file
// copying flows through the CLI library (AD-1, AD-9). No `installScriptsDeps`
// — `pipeline.js` is an esbuild bundle, no runtime npm install is needed.

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

// Install/upgrade orchestrator — native installer logic, independent of `cli/`.
import { installHarness } from './lib/install/install-harness.js';

// Config generation
import { generateConfig, writeConfig } from './lib/config-generator.js';

// Install-time tooling checks (FR-17, AD-11)
import { checkGit, checkGh } from './lib/checks/tooling.js';

// Cross-channel version-drift detection (Claude Code plugin vs installer)
import { detectPluginDrift } from './lib/drift-check.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = __dirname;

// Map wizard harness names → installer/src/<dir>/ bundle subdirectories.
const HARNESS_BUNDLE_DIR = {
  'claude':         'claude',
  'copilot-vscode': 'copilot-vscode',
  'copilot-cli':    'copilot-cli',
};

/**
 * Resolves the absolute path to the bundled plugin payload for a harness.
 * @param {string} harness
 * @returns {string} absolute path to <repoRoot>/src/<bundleDir>/
 */
export function pluginRootForHarness(harness) {
  const bundleDir = HARNESS_BUNDLE_DIR[harness];
  if (!bundleDir) {
    throw new Error(`pluginRootForHarness: unknown harness '${harness}'`);
  }
  return path.join(repoRoot, 'src', bundleDir);
}


/**
 * Renders the post-install summary to stdout. Minimal and harness-aware:
 * lists every harness that was bootstrapped, the canonical config path, the
 * PATH one-liner, and the slash-command pointer for Claude.
 *
 * @param {object} cfg - Wizard output.
 * @param {string} orchYmlPath - Absolute path to the written orchestration.yml
 * @param {string} [installedVersion] - Version just installed. When provided,
 *   triggers cross-channel drift detection against Claude Code's plugin
 *   registry. Omitted in legacy unit tests that don't mock HOME.
 */
export function renderPostInstall(cfg, orchYmlPath, installedVersion) {
  console.log('');
  sectionHeader('::', 'Installation Complete');
  console.log('');
  for (const h of cfg.harnesses) {
    console.log('  ' + THEME.success('✔') + ' ' + THEME.body(`harness '${h}' bootstrapped`));
  }
  console.log('  ' + THEME.success('✔') + ' ' + THEME.body('Configuration: ') + THEME.secondary(orchYmlPath));

  console.log('');
  sectionHeader('::', "What's Next");
  console.log('');

  console.log('  ' + THEME.stepNumber('1.') + ' ' + THEME.body('Open your harness and start a new conversation.'));
  console.log('');

  console.log('  ' + THEME.stepNumber('2.') + ' ' + THEME.body('Walk through the orchestration workflow:'));
  console.log('');
  console.log('     ' + THEME.command('/rad-brainstorm') + '  →  ' + THEME.body('refine a project idea'));
  console.log('     ' + THEME.command('/rad-plan') + '        →  ' + THEME.body('produce requirements + master plan'));
  console.log('     ' + THEME.command('/rad-execute') + '     →  ' + THEME.body('run the pipeline through implementation'));
  console.log('');

  if (cfg.harnesses.includes('claude')) {
    console.log('  ' + THEME.stepNumber('3.') + ' ' + THEME.body('(optional) Start the dashboard from inside your harness:'));
    console.log('');
    console.log('     ' + THEME.command('/rad-ui-start'));
    console.log('');
  }

  console.log('  ' + THEME.body('Full guide: ') + THEME.command('https://github.com/MetalHexx/RadOrchestration/blob/main/docs/getting-started.md'));
  console.log('');

  if (installedVersion) {
    const drift = detectPluginDrift(installedVersion);
    if (drift.drift) {
      sectionHeader('::', 'Plugin version drift detected');
      console.log('');
      console.log('  ' + (THEME.warning ? THEME.warning('⚠') : '⚠') + ' ' + THEME.body(
        `This installer just wrote rad-orchestration ${installedVersion} to ~/.radorch, but the`,
      ));
      console.log('     ' + THEME.body('Claude Code plugin is at a different version:'));
      for (const p of drift.plugins) {
        console.log('       ' + THEME.body(`- ${p.key} → ${p.version}`));
      }
      console.log('');
      console.log('  ' + THEME.body('Run the following in Claude Code to keep both channels in sync:'));
      console.log('     ' + THEME.command('/plugin update rad-orchestration'));
      console.log('');
    }
  }
}

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

  // `radorch uninstall` is no longer a top-level installer subcommand —
  // the bundled CLI (`radorch uninstall`, shipped inside the
  // rad-orchestration skill) is the canonical entry point for that flow.
  // The installer print path surfaces the pointer in the post-install summary.
  if (command === 'uninstall') {
    console.log(THEME.body(
      "`radorch uninstall` is now handled by the bundled CLI. After install, run:",
    ));
    if (process.platform === 'win32') {
      console.log('  ' + THEME.command('node %USERPROFILE%\\.claude\\skills\\rad-orchestration\\scripts\\radorch.mjs uninstall'));
    } else {
      console.log('  ' + THEME.command('node $HOME/.claude/skills/rad-orchestration/scripts/radorch.mjs uninstall'));
    }
    return;
  }

  const skipConfirmation = options.skipConfirmation ?? false;

  try {
    renderBanner();

    const gitWarn = checkGit();
    if (gitWarn) console.warn(THEME.warning ? THEME.warning(gitWarn) : `⚠  ${gitWarn}`);
    const ghWarn = checkGh();
    if (ghWarn) console.warn(THEME.warning ? THEME.warning(ghWarn) : `⚠  ${ghWarn}`);

    const config = await runWizard({ skipConfirmation, cliOverrides: options });

    // Bootstrap every selected harness through the canonical CLI library.
    // Each call writes harness-routed files into ~/<harness-dir>/ and shared
    // files into ~/.radorch/.
    console.log('');
    sectionHeader('::', 'Bootstrapping harnesses');
    console.log('');
    // AD-3: legacy installer keeps shared assets (bin/, ui/) at installer/src/
    // and per-harness payloads (agents/, skills/, manifests, package.json) at
    // installer/src/<harness>/. `sharedRoot` resolves the former; `pluginRoot`
    // resolves the latter. The plugin channel ships everything under one root
    // and omits `sharedRoot` (defaults to `pluginRoot`).
    const sharedRoot = path.join(repoRoot, 'src');
    for (const harness of config.harnesses) {
      const pluginRoot = pluginRootForHarness(harness);
      if (!fs.existsSync(path.join(pluginRoot, 'package.json'))) {
        console.error(THEME.error(
          `✖ Bundled plugin payload missing for harness '${harness}' at ${pluginRoot}. `
          + 'Run `node installer/scripts/sync-source.js` and retry.',
        ));
        process.exit(1);
        return;
      }
      const spinner = ora({ text: `Bootstrapping '${harness}'…`, color: THEME.spinner }).start();
      try {
        const result = await installHarness({ pluginRoot, sharedRoot, harness });
        if (result.action === 'downgrade-refused') {
          spinner.warn(`Bootstrapped '${harness}' (${result.action})`);
          if (result.message) console.warn(THEME.warning ? THEME.warning(result.message) : result.message);
        } else {
          spinner.succeed(`Bootstrapped '${harness}' (${result.action})`);
        }
      } catch (err) {
        spinner.fail(`Failed to bootstrap '${harness}': ${err.message}`);
        throw err;
      }
    }

    // Write ~/.radorch/orchestration.yml from the wizard preferences. The
    // canonical user-data root is always ~/.radorch/, regardless of harness.
    const pkgPath = path.join(__dirname, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const ymlSpin = ora({ text: 'Writing orchestration.yml…', color: THEME.spinner }).start();
    const yaml = generateConfig({ packageVersion: pkg.version });
    writeConfig(yaml);
    const orchYmlPath = path.join(os.homedir(), '.radorch', 'orchestration.yml');
    ymlSpin.succeed(`Wrote ${orchYmlPath}`);

    // Ensure ~/.radorch/projects/ exists so the dashboard and agents can scan it.
    fs.mkdirSync(path.join(os.homedir(), '.radorch', 'projects'), { recursive: true });

    renderPostInstall(config, orchYmlPath, pkg.version);
  } catch (err) {
    if (err && err.name === 'ExitPromptError') {
      console.log('');
      process.exit(0);
    }
    console.error(THEME.error(`✖ Installation failed: ${err.message}`));
    process.exit(1);
  }
}

// Auto-invoke only when run directly (not when imported by tests).
// Use fs.realpathSync to resolve symlinks created by `npm link` / global installs.
const __scriptPath = fs.realpathSync(fileURLToPath(import.meta.url));
const __argvPath = process.argv[1] ? fs.realpathSync(process.argv[1]) : '';
if (__scriptPath === __argvPath) {
  main();
}
