import fs from 'node:fs';
import path from 'node:path';
import { userDataPaths } from './user-data-paths.js';

function expand(destPath, paths) {
  return destPath.replaceAll('${RAD_HOME}', paths.root);
}

export function installManifestFiles(manifest, pluginRoot, opts = {}) {
  const paths = userDataPaths(opts);
  const resolvedRoot = path.resolve(paths.root);
  let copied = 0;
  for (const entry of manifest.files) {
    const dest = expand(entry.destinationPath, paths);
    const resolvedDest = path.resolve(dest);
    if (resolvedDest !== resolvedRoot && !resolvedDest.startsWith(resolvedRoot + path.sep)) {
      throw new Error(`install: destination escapes ~/.radorch/: ${dest}`);
    }
    // FR-11: orchestration.yml preserved on existing (user-config ownership skipped on re-install if file exists).
    if (entry.ownership === 'user-config' && fs.existsSync(resolvedDest)) continue;
    const src = path.join(pluginRoot, entry.sourcePath);
    fs.mkdirSync(path.dirname(resolvedDest), { recursive: true });
    fs.copyFileSync(src, resolvedDest);
    copied++;
  }
  return { copied };
}
