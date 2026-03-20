// installer/lib/wizard.js — Interactive wizard orchestrator

import { sectionHeader } from './theme.js';
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
  sectionHeader('🚀', 'Getting Started');
  const gettingStarted = await promptGettingStarted();

  sectionHeader('📁', 'Orchestration Root');
  const orchRoot = await promptOrchRoot();

  sectionHeader('📂', 'Project Storage');
  const projectStorage = await promptProjectStorage();

  sectionHeader('⚙️', 'Pipeline Limits');
  const pipelineLimits = await promptPipelineLimits();

  sectionHeader('🚦', 'Gate Behavior');
  const gateBehavior = await promptGateBehavior();

  sectionHeader('🖥️', 'Dashboard UI');
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
