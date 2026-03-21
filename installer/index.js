#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { confirm } from '@inquirer/prompts';
import ora from 'ora';

// Presentation
import { renderBanner } from './lib/banner.js';
import { THEME, sectionHeader } from './lib/theme.js';
import {
  renderPreInstallSummary,
  renderPostInstallSummary,
  renderPartialSuccessSummary,
} from './lib/summary.js';

// Application
import { runWizard } from './lib/wizard.js';
import { checkNodeNpm, installUi } from './lib/ui-builder.js';

// Domain
import { getManifest } from './lib/manifest.js';
import { generateConfig, writeConfig } from './lib/config-generator.js';
import { resolveOrchRoot } from './lib/path-utils.js';

// Infrastructure
import { copyCategory } from './lib/file-copier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = __dirname;

/**
 * Main installer flow. Exported for testability.
 * @returns {Promise<void>}
 */
export async function main() {
  const args = process.argv.slice(2);
  const skipConfirmation = args.includes('--yes') || args.includes('-y');

  try {
    renderBanner();

    const config = await runWizard({ skipConfirmation });

    // Existing-file detection
    const resolvedRoot = resolveOrchRoot(config.workspaceDir, config.orchRoot);
    const agentsPath = path.join(resolvedRoot, 'agents');
    const skillsPath = path.join(resolvedRoot, 'skills');

    if (fs.existsSync(agentsPath) || fs.existsSync(skillsPath)) {
      console.log(
        THEME.warning(
          `⚠ Existing orchestration files detected at ${resolvedRoot}. Continuing will overwrite them.`
        )
      );
      // Safety gate — NEVER skipped by --yes
      const overwrite = await confirm({
        message: 'Overwrite existing files?',
        default: false,
      });
      if (!overwrite) {
        console.log('Installation cancelled.');
        process.exit(0);
      }
    }

    const manifest = getManifest(config.orchRoot);
    renderPreInstallSummary(config, manifest);

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

      if (result.success) {
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

    const configPath = path.join(resolvedRoot, 'skills', 'orchestration', 'config', 'orchestration.yml');

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
