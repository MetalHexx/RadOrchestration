// installer/lib/summary.js — Summary screens for pre-install, post-install, and partial success

/** @import { InstallerConfig, Manifest, CopyResult } from './types.js' */

import { THEME, sectionHeader, divider } from './theme.js';

// Box drawing characters (single-line Unicode)
const BOX = {
  TL: '┌', TR: '┐', BL: '└', BR: '┘',
  H: '─', V: '│', LT: '├', RT: '┤',
};

// Column widths for the pre-install table
const COL1 = 20; // category name column
const COL2 = 22; // files/value column
const TABLE_WIDTH = COL1 + COL2 + 5; // 2 borders + 3 separators

/**
 * Builds a single horizontal rule row for the table.
 * @param {string} left - Left corner character
 * @param {string} right - Right corner character
 */
function tableRule(left, right) {
  return THEME.secondary(left + BOX.H.repeat(COL1 + 2) + BOX.H + BOX.H.repeat(COL2 + 2) + right);
}

/**
 * Builds a data row for the table.
 * @param {string} label - Category label (plain text, styled separately)
 * @param {string} value - Value string (already styled)
 */
function tableRow(label, value) {
  const labelPadded = label.padEnd(COL1);
  const valuePadded = value;
  return (
    THEME.secondary(BOX.V) +
    '  ' + THEME.body(labelPadded) + ' ' +
    THEME.secondary(BOX.V) +
    '  ' + valuePadded + '  ' +
    THEME.secondary(BOX.V)
  );
}

/**
 * Renders the pre-install confirmation table to stdout.
 * Shows section header, target/root labels, and a Unicode box-drawing table
 * with file counts per manifest category.
 * @param {InstallerConfig} config
 * @param {Manifest} manifest
 * @returns {void}
 */
export function renderPreInstallSummary(config, manifest) {
  console.log('');
  sectionHeader('::', 'Installation Summary');
  console.log('');
  console.log('  ' + THEME.label('Target:') + '  ' + THEME.body(config.workspaceDir));
  console.log('  ' + THEME.label('Root:') + '    ' + THEME.body(config.orchRoot));
  console.log('');

  // Table header
  console.log('  ' + tableRule(BOX.TL, BOX.TR));
  console.log('  ' + tableRow('Category', THEME.body('Files'.padEnd(COL2))));
  console.log('  ' + tableRule(BOX.LT, BOX.RT));

  // Category rows
  for (const cat of manifest.categories) {
    const fileVal = THEME.success('~' + String(cat.fileCount ?? '?').padStart(3));
    console.log('  ' + tableRow(cat.name, fileVal));
  }

  // Config row
  const configVal = THEME.success('     1') + '  ' + THEME.warning('(generated)');
  console.log('  ' + tableRow('Config', configVal));

  // UI row
  if (config.installUi) {
    const uiVal = THEME.warning('  yes  (+ build)');
    console.log('  ' + tableRow('UI', uiVal));
  } else {
    const uiVal = THEME.secondary('   no   (skipped)');
    console.log('  ' + tableRow('UI', uiVal));
  }

  // Separator + Total row
  console.log('  ' + tableRule(BOX.LT, BOX.RT));

  const totalCount = manifest.categories.reduce((sum, cat) => sum + (cat.fileCount ?? 0), 1);
  const totalVal = config.installUi
    ? THEME.success('~' + String(totalCount).padStart(3)) + ' ' + THEME.warning('+ UI')
    : THEME.success('~' + String(totalCount).padStart(3));
  console.log('  ' + tableRow('Total', totalVal));

  console.log('  ' + tableRule(BOX.BL, BOX.BR));
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

  console.log('');
  sectionHeader('::', "What's Next");
  console.log('');

  const validateCmd = `node ${config.orchRoot}/skills/orchestration/scripts/validate/validate-orchestration.js`;

  console.log('  ' + THEME.stepNumber('1.') + ' ' + THEME.body('Validate your installation:'));
  console.log('');
  console.log('     ' + THEME.command(validateCmd));
  console.log('');

  console.log('  ' + THEME.stepNumber('2.') + ' ' + THEME.body('Start your first project — open Copilot Chat and type:'));
  console.log('');
  console.log('     ' + THEME.command('@orchestrator Start a new project: <describe your goal>'));
  console.log('');

  if (config.installUi && config.uiDir) {
    console.log('  ' + THEME.stepNumber('3.') + ' ' + THEME.body('Start the dashboard:'));
    console.log('');
    console.log('     ' + THEME.command(`Local:   cd ${config.uiDir} && npm start`));
    console.log('     ' + THEME.command(`Docker:  docker compose -f ${config.uiDir}/docker-compose.yml up`));
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
  const uiDir = config.uiDir || 'ui';
  const retryCmd = `cd ${uiDir} && npm install && npm run build`;

  console.log('');
  sectionHeader('::', 'Installation Partially Complete');
  console.log('');
  console.log('  ' + THEME.success('✔') + ' ' + THEME.body(`${totalFiles} files installed`));
  console.log('  ' + THEME.success('✔') + ' ' + THEME.body('Configuration: ') + THEME.secondary(configPath));
  console.log('  ' + THEME.error('✖') + ' ' + THEME.error('Dashboard UI: build failed'));
  console.log('');
  console.log('     ' + THEME.errorDetail(error));
  console.log('     ' + THEME.body('The UI source files were copied. You can retry the build manually:'));
  console.log('     ' + THEME.command(retryCmd));
  console.log('');

  console.log('');
  sectionHeader('::', "What's Next");
  console.log('');

  const validateCmd = `node ${config.orchRoot}/skills/orchestration/scripts/validate/validate-orchestration.js`;

  console.log('  ' + THEME.stepNumber('1.') + ' ' + THEME.body('Validate your installation:'));
  console.log('');
  console.log('     ' + THEME.command(validateCmd));
  console.log('');

  console.log('  ' + THEME.stepNumber('2.') + ' ' + THEME.body('Start your first project — open Copilot Chat and type:'));
  console.log('');
  console.log('     ' + THEME.command('@orchestrator Start a new project: <describe your goal>'));
  console.log('');

  console.log('  ' + THEME.stepNumber('3.') + ' ' + THEME.body('Retry the UI build:'));
  console.log('');
  console.log('     ' + THEME.command(retryCmd));
  console.log('');

  divider();
}
