import fs from 'node:fs';
import path from 'node:path';
import { userDataPaths } from './user-data-paths.js';

function expand(destPath, paths) {
  return destPath.replaceAll('${RAD_HOME}', paths.root);
}

export function installManifestFiles(manifest, pluginRoot, opts = {}) {
  const paths = userDataPaths(opts);
  let copied = 0;
  for (const entry of manifest.files) {
    const dest = expand(entry.destinationPath, paths);
    if (!dest.startsWith(paths.root)) {
      throw new Error(`install: destination escapes ~/.radorch/: ${dest}`);
    }
    // FR-11: orchestration.yml preserved on existing (user-config ownership skipped on re-install if file exists).
    if (entry.ownership === 'user-config' && fs.existsSync(dest)) continue;
    const src = path.join(pluginRoot, entry.sourcePath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    copied++;
  }
  return { copied };
}
