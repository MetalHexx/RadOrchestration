// installer/scripts/sync-source.js
// ESM module — "type": "module" in package.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Copies the orchestration source directory (.github/) into installer/src/.github/
 * for local publishing. Used by the `prepack` npm script.
 *
 * Behavior:
 *   1. Resolve source: path.resolve(__dirname, '../../.github')
 *   2. Resolve target: path.resolve(__dirname, '../src/.github')
 *   3. Remove target if it exists (clean slate)
 *   4. fs.cpSync(source, target, { recursive: true })
 *   5. Log success message
 *
 * Only runs on `npm pack` / `npm publish`, NOT on `npm install`.
 * In CI, the GitHub Actions workflow performs this copy instead.
 *
 * @param {string} source - Absolute path to the .github/ source directory
 * @param {string} target - Absolute path to the destination directory
 */
/** Names excluded from UI source sync (build artifacts, deps, env files). */
const UI_EXCLUDES = new Set(['node_modules', '.next', '.env.local', '.env']);

/** Names excluded from .github source sync (repo-specific files not for end users). */
const GITHUB_EXCLUDES = new Set(['copilot-instructions.md']);

/**
 * @param {string} source - Absolute path to the source directory
 * @param {string} target - Absolute path to the destination directory
 * @param {Set<string>} [excludes] - Optional set of directory/file names to skip
 */
export function syncSource(source, target, excludes) {
  fs.rmSync(target, { recursive: true, force: true });
  const options = { recursive: true };
  if (excludes) {
    options.filter = (src) => !excludes.has(path.basename(src));
  }
  fs.cpSync(source, target, options);
  console.log(`Synced ${path.basename(source)}/ \u2192 src/${path.basename(target)}/`);
}

// Only execute when run directly (not when imported by tests)
if (process.argv[1] === __filename) {
  syncSource(
    path.resolve(__dirname, '../../.github'),
    path.resolve(__dirname, '../src/.github'),
    GITHUB_EXCLUDES,
  );

  syncSource(
    path.resolve(__dirname, '../../ui'),
    path.resolve(__dirname, '../src/ui'),
    UI_EXCLUDES,
  );
}
