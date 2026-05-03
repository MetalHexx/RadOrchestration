#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { confirm } from '@inquirer/prompts';
import ora from 'ora';
import { createRequire } from 'node:module';

// Presentation
import { renderBanner } from './lib/banner.js';
import { THEME, sectionHeader } from './lib/theme.js';
import {
  renderPreInstallSummary,
  renderPostInstallSummary,
  renderPartialSuccessSummary,
} from './lib/summary.js';

// CLI
import { parseArgs } from './lib/cli.js';
import { renderHelp } from './lib/help.js';

// Application
import { runWizard } from './lib/wizard.js';
import { checkNodeNpm, installUi } from './lib/ui-builder.js';

// Domain
import { getManifest } from './lib/manifest.js';
import { generateConfig, writeConfig } from './lib/config-generator.js';
import { resolveOrchRoot } from './lib/path-utils.js';

// Infrastructure
import { copyCategory } from './lib/file-copier.js';

// Upgrade composition (manifest-aware)
import { readInstalledPackageVersion } from './lib/installed-version.js';
import { loadBundledManifest } from './lib/catalog.js';
import { detectModifiedFiles, confirmModifiedFiles } from './lib/hash-check.js';
import { removeManifestFiles } from './lib/remove.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = __dirname;
const __require = createRequire(import.meta.url);
const { version: __installerVersion } = __require('./package.json');

/**
 * Runs `npm install --omit=dev` in the scripts directory with a spinner.
 * Non-fatal — logs error with manual instructions on failure.
 * @param {string} scriptsDir - Absolute path to the scripts directory
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export function installScriptsDeps(scriptsDir) {
  return new Promise((resolve) => {
    const label = 'Installing pipeline engine dependencies\u2026';
    const spinner = ora({ text: label, color: THEME.spinner }).start();
    let seconds = 0;
    const interval = setInterval(() => {
      seconds += 1;
      spinner.text = `${label} (${seconds}s)`;
    }, 1000);

    const child = spawn('npm install --omit=dev', { cwd: scriptsDir, stdio: 'pipe', shell: true });
    let stderr = '';

    child.stdout.on('data', () => {});

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      clearInterval(interval);
      if (code === 0) {
        spinner.succeed('Pipeline engine dependencies installed');
        resolve({ success: true });
      } else {
        spinner.fail('Pipeline engine dependencies: npm install failed');
        console.log(`  Scripts directory: ${scriptsDir}`);
        console.log(`  Run manually: cd ${scriptsDir} && npm install --omit=dev`);
        resolve({ success: false, error: stderr });
      }
    });

    child.on('error', (err) => {
      clearInterval(interval);
      spinner.fail('Pipeline engine dependencies: npm install failed');
      console.log(`  Scripts directory: ${scriptsDir}`);
      console.log(`  Run manually: cd ${scriptsDir} && npm install --omit=dev`);
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Main installer flow. Exported for testability.
 * @returns {Promise<void>}
 */
export async function main() {
  const args = process.argv.slice(2);
  const { command, options } = parseArgs(args);

  // --help → render and exit
  if (command === 'help') {
    renderHelp();
    return;
  }

  // --version → print and exit
  if (command === 'version') {
    const require = createRequire(import.meta.url);
    const { version } = require('./package.json');
    console.log(version);
    return;
  }

  // uninstall subcommand → resolve orchRoot, delegate to runUninstall.
  if (command === 'uninstall') {
    const { runUninstall } = await import('./lib/uninstall.js');
    const workspaceDir = options.workspaceDir ?? process.cwd();
    const orchRoot = options.orchRoot ?? '.claude';
    const tool = options.tool ?? 'claude-code';
    const resolvedOrchRoot = resolveOrchRoot(workspaceDir, orchRoot);
    await runUninstall({ installerRoot: repoRoot, resolvedOrchRoot, tool });
    return;
  }

  const skipConfirmation = options.skipConfirmation ?? false;
  // Note: `options.overwrite` is still parsed by cli.js for backward-compat
  // invocation strings, but the upgrade path no longer reads it (NFR-5 — the
  // modified-file UX is the only confirmation surface and cannot be bypassed).

  try {
    renderBanner();

    const config = await runWizard({ skipConfirmation, cliOverrides: options });
    config.packageVersion = __installerVersion;

    // Existing-install detection — manifest-aware upgrade composition.
    // Reads the user's package_version, looks up the prior bundled manifest
    // from the catalog, runs the modified-file check, and removes the prior
    // install before proceeding. Pre-manifest installs follow the DD-1 path.
    const resolvedRoot = resolveOrchRoot(config.workspaceDir, config.orchRoot);
    const installed = readInstalledPackageVersion(resolvedRoot);
    if (installed && installed.packageVersion === null) {
      // DD-1: pre-manifest install — print guidance, exit without modifying files.
      console.log('');
      sectionHeader('::', 'Pre-Manifest Install Detected');
      console.log('');
      console.log(THEME.body(
        `The orchestration.yml at ${resolvedRoot} was installed by a pre-manifest version `
        + `(v1.0.0-alpha.7 or earlier). Auto-upgrade is not supported for these installs.`,
      ));
      console.log(THEME.body(
        `Back up any local edits, delete ${resolvedRoot}, then re-run \`radorch\` for a clean install. `
        + `See the MULTI-HARNESS-1 release notes:`,
      ));
      console.log('  ' + THEME.command(
        'https://github.com/MetalHexx/RadOrchestration/blob/main/README.md',
      ));
      process.exit(0);
    }
    if (installed && installed.packageVersion) {
      const priorVersion = installed.packageVersion;
      const priorManifest = loadBundledManifest(repoRoot, config.tool, priorVersion);
      const modified = detectModifiedFiles(priorManifest, resolvedRoot);
      if (modified.length > 0) {
        const proceed = await confirmModifiedFiles(modified, resolvedRoot);
        if (!proceed) {
          console.log('Installation cancelled.');
          process.exit(0);
        }
      }
      const spin = ora({ text: `Removing prior install (v${priorVersion})…`, color: THEME.spinner }).start();
      const result = removeManifestFiles(priorManifest, resolvedRoot);
      spin.succeed(`Removed ${result.removedCount} files from prior install (v${priorVersion})`);
    }

    const manifest = getManifest(config.orchRoot, config.tool);
    renderPreInstallSummary(config);

    // Pre-install confirmation gate
    if (!skipConfirmation) {
      const proceed = await confirm({
        message: 'Proceed with installation?',
        default: true,
      });
      if (!proceed) {
        console.log('Installation cancelled.');
        process.exit(0);
      }
    }

    // Copy files with per-category ora spinners
    console.log('');
    sectionHeader('::', 'Installing');
    console.log('');
    const targetBase = resolveOrchRoot(config.workspaceDir, config.orchRoot);

    /** @type {import('./lib/types.js').CopyResult[]} */
    const results = [];

    for (const category of manifest.categories) {
      const mergedCategory = {
        ...category,
        excludeDirs: [...(category.excludeDirs || []), ...manifest.globalExcludes],
        excludeFiles: [...(category.excludeFiles || []), ...manifest.globalExcludes],
      };

      const spinner = ora({ text: `Copying ${category.name}...`, color: THEME.spinner }).start();
      const result = copyCategory(mergedCategory, repoRoot, targetBase);

      if (result.skipped) {
        spinner.stop();
      } else if (result.success) {
        spinner.succeed(`Copied ${category.name}  (${result.fileCount} files)`);
      } else {
        spinner.fail(`Failed to copy ${category.name}: ${result.error}`);
      }

      results.push(result);
    }

    // Generate and write config
    const configSpinner = ora({ text: 'Generating orchestration.yml...', color: THEME.spinner }).start();
    const yamlContent = generateConfig(config);
    writeConfig(config.workspaceDir, config.orchRoot, yamlContent);
    configSpinner.succeed('Generated orchestration.yml');

    // Create the project storage directory so the dashboard and agents can scan it immediately
    const projectsSpinner = ora({ text: 'Creating projects directory...', color: THEME.spinner }).start();
    const resolvedProjectsPath = path.isAbsolute(config.projectsBasePath)
      ? config.projectsBasePath
      : path.join(config.workspaceDir, config.projectsBasePath);
    fs.mkdirSync(resolvedProjectsPath, { recursive: true });
    projectsSpinner.succeed('Created projects directory');

    // Install pipeline engine dependencies (non-fatal)
    const scriptsDir = path.join(targetBase, 'skills', 'rad-orchestration', 'scripts');
    await installScriptsDeps(scriptsDir);

    const configPath = path.join(resolvedRoot, 'skills', 'rad-orchestration', 'config', 'orchestration.yml');

    if (config.installUi) {
      console.log('');
      sectionHeader('::', 'Dashboard UI');
      console.log('');

      const nodeCheck = checkNodeNpm();
      if (!nodeCheck.available) {
        console.log(THEME.warning('⚠ ' + nodeCheck.error));
        const continueWithout = await confirm({
          message: 'Continue without the dashboard UI?',
          default: true,
        });
        if (!continueWithout) {
          console.log('Installation cancelled.');
          process.exit(0);
        }
        config.installUi = false;
      } else {
        const uiResult = await installUi({
          repoRoot,
          uiDir: config.uiDir,
          workspaceDir: config.workspaceDir,
          orchRoot: config.orchRoot,
          projectsBasePath: config.projectsBasePath,
        });

        if (!uiResult.buildSuccess) {
          renderPartialSuccessSummary(config, results, configPath, uiResult.error);
          return;
        }
      }
    }

    renderPostInstallSummary(config, results, configPath);
  } catch (err) {
    if (err.name === 'ExitPromptError') {
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
const __argvPath = fs.realpathSync(process.argv[1]);
if (__scriptPath === __argvPath) {
  main();
}
