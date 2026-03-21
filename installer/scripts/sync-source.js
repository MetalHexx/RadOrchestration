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
export function syncSource(source, target) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
  console.log('Synced .github/ → src/.github/');
}

// Only execute when run directly (not when imported by tests)
if (process.argv[1] === __filename) {
  const source = path.resolve(__dirname, '../../.github');
  const target = path.resolve(__dirname, '../src/.github');
  syncSource(source, target);
}
