// installer/lib/summary.js — Summary screens for pre-install, post-install, and partial success

/** @import { InstallerConfig, CopyResult } from './types.js' */

import path from 'node:path';
import { THEME, sectionHeader, divider } from './theme.js';

/**
 * Renders the pre-install confirmation screen to stdout.
 * Shows section header and target/root labels.
 * @param {InstallerConfig} config
 * @returns {void}
 */
export function renderPreInstallSummary(config) {
  console.log('');
  sectionHeader('::', 'Installation Summary');
  console.log('');
  console.log('  ' + THEME.label('Target:') + '  ' + THEME.body(path.normalize(config.workspaceDir)));
  console.log('  ' + THEME.label('Root:') + '    ' + THEME.body(path.normalize(config.orchRoot)));
  console.log('');
}

/**
 * Renders the post-install success screen to stdout.
 * Shows check marks for installed items, config path, and numbered next-steps
 * with runnable commands using resolved paths.
 * @param {InstallerConfig} config
 * @param {CopyResult[]} copyResults
 * @param {string} configPath - Full resolved path to orchestration.yml
 * @returns {void}
 */
export function renderPostInstallSummary(config, copyResults, configPath) {
  const totalFiles = copyResults.reduce((sum, r) => sum + r.fileCount, 0);

  console.log('');
  sectionHeader('::', 'Installation Complete');
  console.log('');
  console.log('  ' + THEME.success('✔') + ' ' + THEME.body(`${totalFiles} files installed`));
  console.log('  ' + THEME.success('✔') + ' ' + THEME.body('Configuration: ') + THEME.secondary(configPath));

  if (config.installUi) {
    console.log('  ' + THEME.success('✔') + ' ' + THEME.body('Dashboard UI: ') + THEME.success('built and ready'));
  } else {
    console.log('  ' + THEME.secondary('–') + ' ' + THEME.secondary('Dashboard UI: skipped'));
  }

  if (config.installMemory) {
    console.log('  ' + THEME.success('✔') + ' ' + THEME.body('Memory: ') + THEME.success(`enabled · auto-ingest: ${config.autoIngest}`));
  } else if (config.memoryInstallFailed) {
    console.log('  ' + THEME.error('✖') + ' ' + THEME.error('Memory: disabled (install failed — see manual steps above)'));
  } else {
    console.log('  ' + THEME.secondary('–') + ' ' + THEME.secondary('Memory: disabled'));
  }

  console.log('');
  sectionHeader('::', "What's Next");
  console.log('');

  console.log('  ' + THEME.stepNumber('1.') + ' ' + THEME.body('Get started — visit the guide:'));
  console.log('');
  console.log('     ' + THEME.command('https://github.com/MetalHexx/RadOrchestation/blob/main/docs/guides.md'));
  console.log('');

  if (config.installUi && config.uiDir) {
    console.log('  ' + THEME.stepNumber('2.') + ' ' + THEME.body('Start the dashboard:'));
    console.log('');
    console.log('     ' + THEME.command(`Local:   cd ${path.normalize(config.uiDir)} && npm start`));
    console.log('     ' + THEME.command(`Docker:  docker compose -f ${path.join(config.uiDir, 'docker-compose.yml')} up`));
    console.log('');
  }

  divider();
}

/**
 * Renders the partial-success screen when UI build fails.
 * Shows green checks for core items, red X for UI failure, error detail,
 * retry command, and next-steps.
 * @param {InstallerConfig} config
 * @param {CopyResult[]} copyResults
 * @param {string} configPath - Full resolved path to orchestration.yml
 * @param {string} error - Error message from the UI build failure
 * @returns {void}
 */
export function renderPartialSuccessSummary(config, copyResults, configPath, error) {
  const totalFiles = copyResults.reduce((sum, r) => sum + r.fileCount, 0);
  const uiDir = path.normalize(config.uiDir || 'ui');
  const retryCmd = `cd ${uiDir} && npm install && npm run build`;

  console.log('');
  sectionHeader('::', 'Installation Partially Complete');
  console.log('');
  console.log('  ' + THEME.success('✔') + ' ' + THEME.body(`${totalFiles} files installed`));
  console.log('  ' + THEME.success('✔') + ' ' + THEME.body('Configuration: ') + THEME.secondary(configPath));
  console.log('  ' + THEME.error('✖') + ' ' + THEME.error('Dashboard UI: build failed'));

  if (config.installMemory) {
    console.log('  ' + THEME.success('✔') + ' ' + THEME.body('Memory: ') + THEME.success(`enabled · auto-ingest: ${config.autoIngest}`));
  } else if (config.memoryInstallFailed) {
    console.log('  ' + THEME.error('✖') + ' ' + THEME.error('Memory: disabled (install failed — see manual steps above)'));
  } else {
    console.log('  ' + THEME.secondary('–') + ' ' + THEME.secondary('Memory: disabled'));
  }

  console.log('');
  console.log('     ' + THEME.errorDetail(error));
  const copyMsg = error.includes('ENOENT') && error.includes('src')
    ? 'The UI source files could not be found. Ensure the package is built correctly, then retry:'
    : 'The UI source files were copied. You can retry the build manually:';
  console.log('     ' + THEME.body(copyMsg));
  console.log('     ' + THEME.command(retryCmd));
  console.log('');

  console.log('');
  sectionHeader('::', "What's Next");
  console.log('');

  console.log('  ' + THEME.stepNumber('1.') + ' ' + THEME.body('Get started — visit the guide:'));
  console.log('');
  console.log('     ' + THEME.command('https://github.com/MetalHexx/RadOrchestation/blob/main/docs/guides.md'));
  console.log('');

  console.log('  ' + THEME.stepNumber('2.') + ' ' + THEME.body('Retry the UI build:'));
  console.log('');
  console.log('     ' + THEME.command(retryCmd));
  console.log('');

  divider();
}
