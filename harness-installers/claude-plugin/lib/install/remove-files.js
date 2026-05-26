import fs from 'node:fs';
import path from 'node:path';
import { userDataPaths } from './user-data-paths.js';

/** Removes every non-user-config entry then prunes empty parent dirs upward,
 *  with ~/.radorc/projects/ always skipped. */
export function removeManifestFiles(manifest, opts = {}) {
  const paths = userDataPaths(opts);
  // Resolve both anchors once so containment checks survive mixed separators
  // (manifest paths use POSIX `/`, paths.* use the platform separator) and the
  // sibling-prefix bypass that plain startsWith allows.
  const rootResolved = path.resolve(paths.root);
  const projectsResolved = path.resolve(paths.projects);
  const isUnder = (parent, child) => {
    const rel = path.relative(parent, child);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  };
  const touched = new Set();
  for (const entry of manifest.files) {
    if (entry.ownership === 'user-config') continue;
    const dest = path.resolve(entry.destinationPath.replaceAll('${RAD_HOME}', paths.root));
    // Hard guards: never delete outside paths.root; never touch the projects tree.
    if (!isUnder(rootResolved, dest)) continue;
    if (dest === projectsResolved || isUnder(projectsResolved, dest)) continue;
    if (fs.existsSync(dest)) fs.rmSync(dest, { force: true });
    let parent = path.dirname(dest);
    while (isUnder(rootResolved, parent) && parent !== projectsResolved) {
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
