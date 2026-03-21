// installer/lib/manifest.js — Declarative file copy manifest

/** @import { Manifest, ManifestCategory } from './types.js' */

/**
 * Returns the complete file copy manifest.
 * @param {string} orchRoot - The orchestration root folder name (e.g., '.github')
 * @returns {Manifest}
 */
export function getManifest(orchRoot) {
  /** @type {ManifestCategory[]} */
  const categories = [
    {
      name: 'Root config',
      sourceDir: 'src/.github',
      targetDir: '.',
      recursive: false,
    },
    {
      name: 'Agents',
      sourceDir: 'src/.github/agents',
      targetDir: 'agents',
      recursive: false,
    },
    {
      name: 'Instructions',
      sourceDir: 'src/.github/instructions',
      targetDir: 'instructions',
      recursive: false,
    },
    {
      name: 'Prompts',
      sourceDir: 'src/.github/prompts',
      targetDir: 'prompts',
      recursive: false,
    },
    {
      name: 'Hooks',
      sourceDir: 'src/.github/hooks',
      targetDir: 'hooks',
      recursive: false,
    },
    {
      name: 'Skills',
      sourceDir: 'src/.github/skills',
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
