// installer/lib/config-generator.js — Config generator module

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** @import { InstallerConfig } from './types.js' */

/**
 * Generates orchestration.yml content with the ten canonical keys.
 * @param {object} config - Configuration object with version, template, limits, and gates
 * @param {string} config.packageVersion - rad-orchestration package version
 * @param {string} config.defaultTemplate - Default template tier (extra-high, high, medium, low)
 * @param {number} config.maxPhases - Maximum phases per project
 * @param {number} config.maxTasksPerPhase - Maximum tasks per phase
 * @param {number} config.maxRetriesPerTask - Auto-retries before escalation
 * @param {number} config.maxConsecutiveReviewRejections - Review rejects before human escalation
 * @param {boolean} config.afterPlanning - Gate after planning (hard default: true)
 * @param {string} config.executionMode - Execution mode (ask, phase, task, autonomous)
 * @param {boolean} config.afterFinalReview - Gate after final review (hard default: true)
 * @param {string} config.autoCommit - Auto-commit behavior (always, ask, never)
 * @param {string} config.autoPr - Auto-PR behavior (always, ask, never)
 * @returns {string} - Complete YAML file content
 */
export function generateConfig(config) {
  return `# orchestration.yml
version: "1.0"
package_version: ${config.packageVersion}
default_template: ${config.defaultTemplate}
limits:
  max_phases: ${config.maxPhases}
  max_tasks_per_phase: ${config.maxTasksPerPhase}
  max_retries_per_task: ${config.maxRetriesPerTask}
  max_consecutive_review_rejections: ${config.maxConsecutiveReviewRejections}
human_gates:
  after_planning: ${config.afterPlanning}
  execution_mode: "${config.executionMode}"
  after_final_review: ${config.afterFinalReview}
source_control:
  auto_commit: "${config.autoCommit}"
  auto_pr: "${config.autoPr}"
`;
}

/**
 * Writes orchestration.yml to ~/.radorch/orchestration.yml, creating intermediate directories.
 * @param {string} yamlContent - Generated YAML content
 * @returns {void}
 */
export function writeConfig(yamlContent) {
  const orchYmlPath = path.join(os.homedir(), '.radorch', 'orchestration.yml');
  fs.mkdirSync(path.dirname(orchYmlPath), { recursive: true });
  fs.writeFileSync(orchYmlPath, yamlContent);
}
