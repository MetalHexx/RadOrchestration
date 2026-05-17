import fs from 'node:fs';
import path from 'node:path';
import { userDataPaths } from './user-data-paths.js';

/** Removes every non-user-config entry then prunes empty parent dirs upward,
 *  with ~/.radorch/projects/ always skipped (FR-11, AD-13). */
export function removeManifestFiles(manifest, opts = {}) {
  const paths = userDataPaths(opts);
  const touched = new Set();
  for (const entry of manifest.files) {
    if (entry.ownership === 'user-config') continue;
    const dest = entry.destinationPath.replaceAll('${RAD_HOME}', paths.root);
    if (dest.startsWith(paths.projects)) continue;
    if (fs.existsSync(dest)) fs.rmSync(dest, { force: true });
    let parent = path.dirname(dest);
    while (parent.startsWith(paths.root) && parent !== paths.root && parent !== paths.projects) {
      touched.add(parent);
      parent = path.dirname(parent);
    }
  }
  const sorted = [...touched].sort((a, b) => b.length - a.length);
  for (const dir of sorted) {
    if (!fs.existsSync(dir)) continue;
    try {
      if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    } catch { /* race / permission */ }
  }
}
