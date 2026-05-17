import fs from 'node:fs';
import path from 'node:path';
import { userDataPaths } from './user-data-paths.js';

function expand(destPath, paths) {
  return destPath.replaceAll('${RAD_HOME}', paths.root);
}

/** Copies every entry in the manifest from <pluginRoot>/<sourcePath> to its
 *  expanded destinationPath. AD-2: every destination must live under
 *  paths.root. */
export function installManifestFiles(manifest, pluginRoot, opts = {}) {
  const paths = userDataPaths(opts);
  let copied = 0;
  for (const entry of manifest.files) {
    const dest = expand(entry.destinationPath, paths);
    if (!dest.startsWith(paths.root)) {
      throw new Error(`install: destination escapes ~/.radorch/: ${dest}`);
    }
    const src = path.join(pluginRoot, entry.sourcePath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    copied++;
  }
  return { copied };
}
