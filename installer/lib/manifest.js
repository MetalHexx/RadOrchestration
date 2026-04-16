// installer/lib/manifest.js — Declarative file copy manifest

/** @import { Manifest, ManifestCategory } from './types.js' */

/**
 * Returns the complete file copy manifest.
 * @param {string} orchRoot - The orchestration root folder name (e.g., '.claude')
 * @returns {Manifest}
 */
export function getManifest(orchRoot) {
  /** @type {ManifestCategory[]} */
  const categories = [
    {
      name: 'Root config',
      sourceDir: 'src/.claude',
      targetDir: '.',
      recursive: false,
    },
    {
      name: 'Agents',
      sourceDir: 'src/.claude/agents',
      targetDir: 'agents',
      recursive: false,
    },
    {
      name: 'Skills',
      sourceDir: 'src/.claude/skills',
      targetDir: 'skills',
      recursive: true,
      excludeDirs: ['orchestration-staging'],
    },
  ];

  return {
    categories,
    globalExcludes: ['node_modules', '.next', '.env.local', 'package-lock.json'],
  };
}
