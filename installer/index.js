#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
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
import { isTotalRecallInstalled, installTotalRecall, registerMcpServer } from './lib/prompts/memory-install.js';
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

  const skipConfirmation = options.skipConfirmation ?? false;
  const forceOverwrite = options.overwrite ?? false;

  try {
    renderBanner();

    const config = await runWizard({ skipConfirmation, cliOverrides: options });

    // Existing-file detection
    const resolvedRoot = resolveOrchRoot(config.workspaceDir, config.orchRoot);
    const agentsPath = path.join(resolvedRoot, 'agents');
    const skillsPath = path.join(resolvedRoot, 'skills');

    if (fs.existsSync(agentsPath) || fs.existsSync(skillsPath)) {
      if (forceOverwrite) {
        console.log(
          THEME.warning(
            `⚠ Existing orchestration files detected at ${resolvedRoot}. Overwriting (--overwrite).`
          )
        );
      } else {
        console.log(
          THEME.warning(
            `⚠ Existing orchestration files detected at ${resolvedRoot}. Continuing will overwrite them.`
          )
        );
        // Safety gate — NEVER skipped by --yes alone
        const overwrite = await confirm({
          message: 'Overwrite existing files?',
          default: false,
        });
        if (!overwrite) {
          console.log('Installation cancelled.');
          process.exit(0);
        }
      }
    }

    const manifest = getManifest(config.orchRoot);
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

    // Create the project storage directory so the dashboard and agents can scan it immediately
    const projectsSpinner = ora({ text: 'Creating projects directory...', color: THEME.spinner }).start();
    const resolvedProjectsPath = path.isAbsolute(config.projectsBasePath)
      ? config.projectsBasePath
      : path.join(config.workspaceDir, config.projectsBasePath);
    fs.mkdirSync(resolvedProjectsPath, { recursive: true });
    projectsSpinner.succeed('Created projects directory');

    // ── Memory System ────────────────────────────────────────────────────
    if (config.installMemory) {
      console.log('');
      sectionHeader('::', 'Memory System');
      console.log('');

      const alreadyInstalled = await isTotalRecallInstalled();

      if (alreadyInstalled) {
        console.log(THEME.success('✓ total-recall is already installed'));
      }

      if (!alreadyInstalled) {
        const installSpinner = ora({ text: 'Installing total-recall...', color: THEME.spinner }).start();
        const installResult = await installTotalRecall();

        if (installResult.success) {
          installSpinner.succeed('total-recall installed');
        } else {
          installSpinner.fail('Installation failed');
          console.log(THEME.errorDetail(installResult.error));
          console.log(THEME.body('To install manually:'));
          console.log(THEME.command('  npm install -g @strvmarv/total-recall'));

          const continueWithout = await confirm({
            message: 'Continue without memory?',
            default: true,
          });

          if (continueWithout) {
            config.installMemory = false;
            config.memoryInstallFailed = true;
          } else {
            process.exit(1);
          }
        }
      }

      if (config.installMemory) {
        const mcpSpinner = ora({ text: 'Registering MCP server...', color: THEME.spinner }).start();
        const mcpResult = registerMcpServer(config.workspaceDir);

        if (mcpResult.success) {
          mcpSpinner.succeed('MCP server registered (.vscode/mcp.json)');
          if (mcpResult.merged) {
            console.log(THEME.hint('  Merged into existing .vscode/mcp.json'));
          }
        } else {
          mcpSpinner.fail('MCP registration failed');
          console.log(THEME.errorDetail(mcpResult.error));
          console.log(THEME.body('To configure manually, add to .vscode/mcp.json:'));
          console.log(THEME.command('  { "servers": { "total-recall": { "command": "total-recall" } } }'));

          const continueWithout = await confirm({
            message: 'Continue without memory?',
            default: true,
          });

          if (!continueWithout) {
            process.exit(1);
          }
          config.memoryInstallFailed = true;
          config.installMemory = false;
        }
      }
    }

    // Generate and write config — must happen after Memory System so config reflects final installMemory state
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
