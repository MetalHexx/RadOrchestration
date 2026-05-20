import fs from 'node:fs';
import path from 'node:path';
import { userDataPaths } from './user-data-paths.js';

export function removeManifestFiles(manifest, opts = {}) {
  const paths = userDataPaths(opts);
  const resolvedRoot = path.resolve(paths.root);
  const resolvedProjects = path.resolve(paths.projects);
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
