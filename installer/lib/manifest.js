// installer/lib/manifest.js — Declarative file copy manifest (harness-aware).
//
// Deprecated as of the GLOBAL-WORKSPACES refactor: the installer no longer
// drives copies through getManifest/file-copier — it routes every harness
// through the CLI's `runPluginBootstrap`, which consumes the per-version
// manifest catalog at `installer/src/<harness>/manifests/v<version>.json`.
// This module is retained for now because external tests still import it,
// but no production code path calls into it.

/** @import { Manifest, ManifestCategory } from './types.js' */

/**
 * Returns the complete file copy manifest for the chosen harness. Each
 * adapter's published bundle lives under `installer/src/<harness>/`; this
 * function points (historical) file-copier consumers at the right one. The
 * canonical install path uses the manifest catalog at
 * `installer/src/<harness>/manifests/v<version>.json` instead.
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
    globalExcludes: [
      'node_modules', '.next', '.env.local', 'package-lock.json',
      // Dev-only artifacts that should never ship to end users:
      'tests',                  // pipeline test directory
      'dist', 'dist-bundle',    // tsc / esbuild output dirs (gitignored)
      'vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs',
      'tsconfig.tsbuildinfo',
    ],
  };
}
