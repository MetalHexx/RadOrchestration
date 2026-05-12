// installer/lib/config-generator.js — Config generator module

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** @import { InstallerConfig } from './types.js' */

/**
 * Generates orchestration.yml content with the ten canonical properties (FR-16).
 * The function accepts the input config but ignores branch fields — all ten
 * properties are emitted unconditionally at their canonical default values.
 *
 * @param {object} config - Configuration object
 * @param {string} config.packageVersion - rad-orchestration package version
 * @returns {string} - Complete YAML file content
 */
export function generateConfig({ packageVersion }) {
  // FR-16: canonical 10 properties, no branching on input config.
  return `# orchestration.yml
version: "1.0"
package_version: ${packageVersion}
default_template: ask
limits:
  max_phases: 10
  max_tasks_per_phase: 8
  max_retries_per_task: 5
  max_consecutive_review_rejections: 3
human_gates:
  after_planning: true
  execution_mode: "ask"
  after_final_review: true
source_control:
  auto_commit: "ask"
  auto_pr: "ask"
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
