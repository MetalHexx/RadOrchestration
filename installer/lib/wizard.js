// installer/lib/wizard.js — Interactive wizard orchestrator

import path from 'node:path';
import { THEME, sectionHeader } from './theme.js';
import { promptGettingStarted } from './prompts/getting-started.js';
import { promptOrchRoot } from './prompts/orch-root.js';
import { promptProjectStorage } from './prompts/project-storage.js';
import { promptPipelineLimits } from './prompts/pipeline-limits.js';
import { promptGateBehavior } from './prompts/gate-behavior.js';
import { promptSourceControl } from './prompts/source-control.js';
import { promptMemoryInstall } from './prompts/memory-install.js';
import { promptUiInstall } from './prompts/ui-install.js';

/**
 * Default values for each prompt section, used when --yes fills in unspecified CLI options.
 * @type {import('./types.js').InstallerConfig}
 */
const DEFAULTS = {
  tool: 'copilot',
  workspaceDir: process.cwd(),
  orchRoot: '.github',
  projectsBasePath: 'orchestration-projects',
  projectsNaming: 'SCREAMING_CASE',
  maxPhases: 10,
  maxTasksPerPhase: 8,
  maxRetriesPerTask: 2,
  maxConsecutiveReviewRejections: 3,
  executionMode: 'ask',
  autoCommit: 'ask',
  autoPr: 'ask',
  provider: 'github',
  installUi: true,
  skipConfirmation: false,
  installMemory: false,
  autoIngest: 'never',
};

/**
 * Runs the wizard prompt sequence. When cliOverrides are provided and
 * skipConfirmation is true, prompts are skipped for sections whose values
 * are fully covered by the overrides + defaults.
 *
 * @param {Object} options
 * @param {boolean} options.skipConfirmation - Whether to skip interactive prompts
 * @param {Partial<import('./types.js').CliOptions>} [options.cliOverrides] - CLI-provided values
 * @returns {Promise<import('./types.js').InstallerConfig>}
 */
export async function runWizard({ skipConfirmation, cliOverrides = {} }) {
  const has = (/** @type {string} */ key) => cliOverrides[key] !== undefined;
  const useDefaults = skipConfirmation; // --yes means use defaults for unspecified values

  // ── Getting Started ──────────────────────────────────────────────────────
  let gettingStarted;
  if (useDefaults || (has('tool') && has('workspaceDir'))) {
    gettingStarted = {
      tool: cliOverrides.tool ?? DEFAULTS.tool,
      workspaceDir: cliOverrides.workspaceDir ?? DEFAULTS.workspaceDir,
    };
  } else {
    console.log('');
    sectionHeader('::', 'Getting Started');
    console.log('');
    gettingStarted = await promptGettingStarted();
  }

  // ── Orchestration Root ───────────────────────────────────────────────────
  let orchRoot;
  if (useDefaults || has('orchRoot')) {
    orchRoot = { orchRoot: cliOverrides.orchRoot ?? DEFAULTS.orchRoot };
  } else {
    console.log('');
    sectionHeader('::', 'Orchestration Root');
    console.log('');
    console.log(THEME.hint('  Folder where agents, skills, and prompts are installed. Relative to workspace or absolute.'));
    console.log('');
    orchRoot = await promptOrchRoot();
  }

  // ── Project Storage ──────────────────────────────────────────────────────
  let projectStorage;
  if (useDefaults || (has('projectsBasePath') && has('projectsNaming'))) {
    projectStorage = {
      projectsBasePath: cliOverrides.projectsBasePath ?? DEFAULTS.projectsBasePath,
      projectsNaming: cliOverrides.projectsNaming ?? DEFAULTS.projectsNaming,
    };
  } else {
    console.log('');
    sectionHeader('::', 'Project Storage');
    console.log('');
    console.log(THEME.hint('  Folder for project files (PRDs, plans, reports). Relative to workspace or absolute.'));
    console.log('');
    projectStorage = await promptProjectStorage();
  }

  // ── Pipeline Limits ──────────────────────────────────────────────────────
  let pipelineLimits;
  if (useDefaults || (has('maxPhases') && has('maxTasksPerPhase') && has('maxRetriesPerTask') && has('maxConsecutiveReviewRejections'))) {
    pipelineLimits = {
      maxPhases: cliOverrides.maxPhases ?? DEFAULTS.maxPhases,
      maxTasksPerPhase: cliOverrides.maxTasksPerPhase ?? DEFAULTS.maxTasksPerPhase,
      maxRetriesPerTask: cliOverrides.maxRetriesPerTask ?? DEFAULTS.maxRetriesPerTask,
      maxConsecutiveReviewRejections: cliOverrides.maxConsecutiveReviewRejections ?? DEFAULTS.maxConsecutiveReviewRejections,
    };
  } else {
    console.log('');
    sectionHeader('::', 'Pipeline Limits');
    console.log('');
    pipelineLimits = await promptPipelineLimits();
  }

  // ── Gate Behavior ────────────────────────────────────────────────────────
  let gateBehavior;
  if (useDefaults || has('executionMode')) {
    gateBehavior = { executionMode: cliOverrides.executionMode ?? DEFAULTS.executionMode };
  } else {
    console.log('');
    sectionHeader('::', 'Gate Behavior');
    console.log('');
    gateBehavior = await promptGateBehavior();
  }

  // ── Source Control ───────────────────────────────────────────────────────
  let sourceControl;
  if (useDefaults || (has('autoCommit') && has('autoPr'))) {
    sourceControl = {
      autoCommit: cliOverrides.autoCommit ?? DEFAULTS.autoCommit,
      autoPr: cliOverrides.autoPr ?? DEFAULTS.autoPr,
      provider: DEFAULTS.provider,
    };
  } else {
    console.log('');
    sectionHeader('::', 'Source Control');
    console.log('');
    sourceControl = await promptSourceControl();
  }

  // ── Memory System ─────────────────────────────────────────────────────
  let memorySystem;
  if (useDefaults && !has('installMemory')) {
    // --yes without --memory: default to off
    memorySystem = {
      installMemory: DEFAULTS.installMemory,
      autoIngest: DEFAULTS.autoIngest,
    };
  } else if (has('installMemory') && !cliOverrides.installMemory) {
    // --no-memory explicitly passed
    memorySystem = {
      installMemory: false,
      autoIngest: 'never',
    };
  } else if (has('installMemory') && cliOverrides.installMemory && has('autoIngest')) {
    // --memory + --auto-ingest: fully covered by CLI
    memorySystem = {
      installMemory: true,
      autoIngest: cliOverrides.autoIngest,
    };
  } else {
    console.log('');
    sectionHeader('::', 'Memory System');
    console.log('');
    console.log(THEME.hint('  Enable project memory to let planning agents recall'));
    console.log(THEME.hint('  decisions and patterns from past projects.'));
    console.log('');

    if (has('installMemory') && cliOverrides.installMemory) {
      // --memory passed without --auto-ingest: skip confirm, run rest of prompt for auto-ingest
      memorySystem = await promptMemoryInstall(gettingStarted.workspaceDir);
    } else {
      memorySystem = await promptMemoryInstall(gettingStarted.workspaceDir);
    }
  }

  // ── Dashboard UI ─────────────────────────────────────────────────────────
  let uiInstall;
  if (useDefaults || has('installUi')) {
    const installUi = cliOverrides.installUi ?? DEFAULTS.installUi;
    uiInstall = { installUi };
    if (installUi) {
      uiInstall.uiDir = cliOverrides.uiDir ?? path.join(gettingStarted.workspaceDir, 'ui');
    }
  } else {
    console.log('');
    sectionHeader('::', 'Dashboard UI');
    console.log('');
    uiInstall = await promptUiInstall(gettingStarted.workspaceDir);
  }

  return {
    ...gettingStarted,
    ...orchRoot,
    ...projectStorage,
    ...pipelineLimits,
    ...gateBehavior,
    ...sourceControl,
    ...memorySystem,
    ...uiInstall,
    skipConfirmation,
  };
}
