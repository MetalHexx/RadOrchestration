// installer/lib/manifest.js — Declarative file copy manifest (harness-aware).

/** @import { Manifest, ManifestCategory } from './types.js' */

/**
 * Returns the complete file copy manifest for the chosen harness. Each
 * adapter's published bundle lives under `installer/src/<harness>/`; this function points the file-copier at the right one.
 *
 * @param {string} orchRoot - Orchestration root folder name (e.g., '.claude')
 * @param {'claude-code' | 'copilot-vscode' | 'copilot-cli'} tool - The chosen harness
 * @returns {Manifest}
 */
export function getManifest(orchRoot, tool) {
  const HARNESS_BUNDLE_DIR = {
    'claude-code': 'claude',
    'copilot-vscode': 'copilot-vscode',
    'copilot-cli': 'copilot-cli',
  };
  const bundleDir = HARNESS_BUNDLE_DIR[tool];
  if (!bundleDir) {
    throw new Error(`getManifest: unknown harness tool '${tool}'`);
  }
  const srcBase = `src/${bundleDir}`;

  /** @type {ManifestCategory[]} */
  const categories = [
    { name: 'Root config', sourceDir: srcBase, targetDir: '.', recursive: false },
    { name: 'Agents', sourceDir: `${srcBase}/agents`, targetDir: 'agents', recursive: false },
    { name: 'Skills', sourceDir: `${srcBase}/skills`, targetDir: 'skills', recursive: true },
  ];

  return {
    categories,
    globalExcludes: ['node_modules', '.next', '.env.local', 'package-lock.json'],
  };
}
