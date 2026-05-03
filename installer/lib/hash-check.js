// installer/lib/hash-check.js — Symmetric content-hash detect-and-warn
// primitive used by both the installer (overwrite gate) and the
// contributor-build CLI (pre-wipe gate). One shared mechanism, one shared
// UX shape, no --force escape hatch in v2 (NFR-5).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { confirm } from '@inquirer/prompts';
import { THEME } from './theme.js';

/**
 * Hex-encoded SHA-256 of a byte buffer.
 * @param {Buffer} bytes
 * @returns {string}
 */
export function hexSha256OfBytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

/**
 * Returns the alphabetically-sorted list of bundlePaths whose on-disk
 * sha256 differs from the manifest. Files missing on disk are ignored
 * (the surrounding install/uninstall flow handles those separately).
 *
 * @param {{ files: Array<{ bundlePath: string, sha256: string }> }} manifest
 * @param {string} resolvedOrchRoot - Absolute path to the user's orchRoot
 * @returns {string[]} - sorted bundlePaths whose on-disk content was modified
 */
export function detectModifiedFiles(manifest, resolvedOrchRoot) {
  const modified = [];
  for (const entry of manifest.files) {
    const abs = path.join(resolvedOrchRoot, entry.bundlePath);
    if (!fs.existsSync(abs)) continue;
    const actual = hexSha256OfBytes(fs.readFileSync(abs));
    if (actual !== entry.sha256) {
      modified.push(entry.bundlePath);
    }
  }
  return modified.sort();
}

/**
 * Renders the modified-file warning UX (DD-2) and prompts the user to
 * confirm. Returns true if the user confirmed, false otherwise. Default
 * is `false` — same default-no posture as the existing overwrite gate
 * in installer/index.js.
 *
 * No --force flag, no environment-variable bypass — strict posture (NFR-5).
 *
 * @param {string[]} modifiedBundlePaths - Output of detectModifiedFiles()
 * @param {string} resolvedOrchRoot - Absolute path used to resolve display paths
 * @param {(opts: { message: string, default: boolean }) => Promise<boolean>} [promptConfirm]
 *   Optional injectable confirm function (defaults to the real @inquirer/prompts confirm).
 *   Callers that need test isolation supply their own stub via this parameter.
 * @returns {Promise<boolean>}
 */
export async function confirmModifiedFiles(modifiedBundlePaths, resolvedOrchRoot, promptConfirm) {
  const doConfirm = promptConfirm ?? confirm;
  console.log('');
  console.log(THEME.warning('⚠ The following files have been locally modified since install:'));
  for (const rel of modifiedBundlePaths) {
    console.log('  ' + path.join(resolvedOrchRoot, rel));
  }
  console.log('');
  return await doConfirm({ message: 'Continue?', default: false });
}
