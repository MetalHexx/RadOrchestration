// installer/lib/file-copier.js — Infrastructure module for copying orchestration files

/** @import { ManifestCategory, Manifest, CopyResult } from './types.js' */

import fs from 'node:fs';
import path from 'node:path';

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
