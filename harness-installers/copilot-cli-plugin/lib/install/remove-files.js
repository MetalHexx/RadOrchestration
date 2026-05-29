import fs from 'node:fs';
import path from 'node:path';
import { userDataPaths } from './user-data-paths.js';

/** Removes every non-user-config entry then prunes empty parent dirs upward,
 *  with ~/.radorc/projects/ always skipped.
 *
 *  FR-20 defensive guard: refuses any manifest entry that targets a path under
 *  ${RAD_HOME}/action-events/custom/. The shipped manifest must never list one;
 *  if one ever appears, abort before touching disk. */
export function removeManifestFiles(manifest, opts = {}) {
  const paths = userDataPaths(opts);
  const resolvedRoot = path.resolve(paths.root);
  const resolvedProjects = path.resolve(paths.projects);

  // FR-20 defensive guard.
  const customSegment = `${path.sep}action-events${path.sep}custom${path.sep}`;
  for (const entry of manifest.files ?? []) {
    const dest = path.resolve(entry.destinationPath.replaceAll('${RAD_HOME}', paths.root));
    if (dest.includes(customSegment)) {
      throw new Error(
        `uninstall safety: manifest entry '${entry.sourcePath ?? entry.destinationPath}' targets an ` +
        `action-events/custom/ payload. Refusing to proceed.`,
      );
    }
  }

  const touched = new Set();
  for (const entry of manifest.files) {
    if (entry.ownership === 'user-config') continue;
    const dest = entry.destinationPath.replaceAll('${RAD_HOME}', paths.root);
    const resolvedDest = path.resolve(dest);
    if (resolvedDest !== resolvedRoot && !resolvedDest.startsWith(resolvedRoot + path.sep)) continue;
    if (resolvedDest === resolvedProjects || resolvedDest.startsWith(resolvedProjects + path.sep)) continue;
    if (fs.existsSync(resolvedDest)) fs.rmSync(resolvedDest, { force: true });
    let parent = path.dirname(resolvedDest);
    while (parent.startsWith(resolvedRoot) && parent !== resolvedRoot && parent !== resolvedProjects) {
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
