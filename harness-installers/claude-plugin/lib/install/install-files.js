import fs from 'node:fs';
import path from 'node:path';
import { userDataPaths } from './user-data-paths.js';

function expand(destPath, paths) {
  return destPath.replaceAll('${RAD_HOME}', paths.root);
}

/** Copies every entry in the manifest from <pluginRoot>/<sourcePath> to its
 *  expanded destinationPath. Every destination must live under
 *  paths.root.
 *
 *  FR-20: any entry marked `ownership: "user-config"` is seeded on first
 *  install only — if the destination already exists, the copy is skipped so
 *  user-edited content is preserved. Symmetric to the user-config
 *  preservation pattern used by the other plugin installers. The canonical
 *  `action-events/custom/README.md` is the second user-config entry (the
 *  first is `orchestration.yml`). */
export function installManifestFiles(manifest, pluginRoot, opts = {}) {
  const paths = userDataPaths(opts);
  // Resolved-relative containment: works across mixed separators (manifest paths
  // use POSIX `/`, paths.root uses the platform separator) and is not bypassable
  // by sibling-prefix paths like `${RAD_HOME}-evil/...`.
  const rootResolved = path.resolve(paths.root);
  let copied = 0;
  for (const entry of manifest.files) {
    const dest = path.resolve(expand(entry.destinationPath, paths));
    const rel = path.relative(rootResolved, dest);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`install: destination escapes ~/.radorc/: ${dest}`);
    }
    // FR-20 / FR-14: user-config entries are seeded on first install only.
    if (entry.ownership === 'user-config' && fs.existsSync(dest)) continue;
    const src = path.join(pluginRoot, entry.sourcePath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    copied++;
  }
  return { copied };
}
