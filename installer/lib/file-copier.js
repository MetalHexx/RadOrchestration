// installer/lib/file-copier.js — Infrastructure module for copying orchestration files.
//
// Deprecated as of the GLOBAL-WORKSPACES refactor: the installer routes
// copies through the CLI library's `installManifestFiles` via
// `runPluginBootstrap`. This module is retained because its tests still
// exercise the historical copy semantics, but no production code path
// imports it.

/** @import { ManifestCategory, Manifest, CopyResult } from './types.js' */

import fs from 'node:fs';
import path from 'node:path';

// Test-source files (e.g. `engine.test.ts`, `mutations.spec.js`) are dev-only
// and never run at end-user runtime. Excluding them keeps installs lean and
// stops shipping internals. Mirrored in adapters/run-plugin.js — keep in sync.
const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/i;

/**
 * Copies all files for a single manifest category.
 * Creates target directories as needed via fs.mkdirSync.
 * @param {ManifestCategory} category - Category definition from manifest
 * @param {string} repoRoot - Absolute path to the installer's repository root
 * @param {string} targetBase - Absolute path to the resolved orch root in target workspace
 * @returns {CopyResult}
 */
export function copyCategory(category, repoRoot, targetBase) {
  const src = path.join(repoRoot, category.sourceDir);
  const dest = path.join(targetBase, category.targetDir);
  let fileCount = 0;

  if (!fs.existsSync(src)) {
    return { category: category.name, fileCount: 0, success: true, skipped: true };
  }

  try {
    fs.mkdirSync(dest, { recursive: true });

    const excludeSet = new Set([
      ...(category.excludeDirs || []),
      ...(category.excludeFiles || []),
    ]);

    fs.cpSync(src, dest, {
      recursive: true,
      filter(source) {
        if (source === src) return true;

        const basename = path.basename(source);
        if (excludeSet.has(basename)) return false;

        const isDir = fs.statSync(source).isDirectory();
        if (category.recursive === false && isDir) return false;

        // Reject *.test.* / *.spec.* files anywhere in the tree (dev-only).
        if (!isDir && TEST_FILE_RE.test(basename)) return false;

        if (!isDir) fileCount++;

        return true;
      },
    });

    return { category: category.name, fileCount, success: true };
  } catch (err) {
    return { category: category.name, fileCount: 0, success: false, error: err.message };
  }
}

/**
 * Copies all categories in the manifest sequentially.
 * Merges globalExcludes into each category's exclude lists before copying.
 * Errors in one category do not prevent remaining categories from being copied.
 * @param {Manifest} manifest - The complete file manifest
 * @param {string} repoRoot - Absolute path to the installer's repository root
 * @param {string} targetBase - Absolute path to the resolved orch root in target workspace
 * @returns {CopyResult[]}
 */
export function copyAll(manifest, repoRoot, targetBase) {
  const results = [];

  for (const category of manifest.categories) {
    const mergedCategory = {
      ...category,
      excludeDirs: [...(category.excludeDirs || []), ...manifest.globalExcludes],
      excludeFiles: [...(category.excludeFiles || []), ...manifest.globalExcludes],
    };
    results.push(copyCategory(mergedCategory, repoRoot, targetBase));
  }

  return results;
}
