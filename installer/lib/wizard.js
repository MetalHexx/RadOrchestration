// installer/lib/wizard.js — Interactive wizard orchestrator

import { THEME, sectionHeader } from './theme.js';
import { promptGettingStarted } from './prompts/getting-started.js';
import { promptOrchRoot } from './prompts/orch-root.js';
import { promptProjectStorage } from './prompts/project-storage.js';
import { promptPipelineLimits } from './prompts/pipeline-limits.js';
import { promptGateBehavior } from './prompts/gate-behavior.js';
import { promptUiInstall } from './prompts/ui-install.js';

/**
 * Runs the full interactive wizard prompt sequence.
 * @param {Object} options
 * @param {boolean} options.skipConfirmation - Whether to skip the pre-install confirmation
 * @returns {Promise<import('./types.js').InstallerConfig>}
 */
export async function runWizard({ skipConfirmation }) {
  console.log('');
  sectionHeader('::', 'Getting Started');
  console.log('');
  const gettingStarted = await promptGettingStarted();

  console.log('');
  sectionHeader('::', 'Orchestration Root');
  console.log('');
  console.log(THEME.hint('  The orchestration root is the folder inside your workspace where agents, skills, and prompts will be installed (e.g., .github).'));
  console.log('');
  const orchRoot = await promptOrchRoot();

  console.log('');
  sectionHeader('::', 'Project Storage');
  console.log('');
  console.log(THEME.hint('  The project storage path is where orchestration project files — PRDs, plans, task reports — will be saved.'));
  console.log('');
  const projectStorage = await promptProjectStorage();

  console.log('');
  sectionHeader('::', 'Pipeline Limits');
  console.log('');
  const pipelineLimits = await promptPipelineLimits();

  console.log('');
  sectionHeader('::', 'Gate Behavior');
  console.log('');
  const gateBehavior = await promptGateBehavior();

  console.log('');
  sectionHeader('::', 'Dashboard UI');
  console.log('');
  const uiInstall = await promptUiInstall(gettingStarted.workspaceDir);

  return {
    ...gettingStarted,
    ...orchRoot,
    ...projectStorage,
    ...pipelineLimits,
    ...gateBehavior,
    ...uiInstall,
    skipConfirmation,
  };
}
