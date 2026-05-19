// greenfield/harness-installers/standard/lib/install/hydrate-user-data.js —
// Writes user-data files under ~/.radorch/ with the following preservation rules
// (AD-13 "sole-writer per file class"):
//
//   orchestration.yml  — copied only when absent (FR-14)
//   templates/         — shipped set (4 files) always overwritten; user-added
//                        templates preserved (FR-15, NFR-10)
//   ui/                — replaced atomically via tmp-rename (FR-16, AD-9)
//   projects/, logs/   — created if absent; existing contents never touched (FR-2)

import fs from 'node:fs';
import path from 'node:path';
import { userDataPaths } from './user-data-paths.js';

// The four shipped tier template filenames — constant, never derived from readdir.
const SHIPPED_TIER_FILES = ['extra-high.yml', 'high.yml', 'medium.yml', 'low.yml'];

/**
 * Hydrate the user-data directory (~/.radorch/) from the installer bundle.
 *
 * @param {{
 *   bundleRoot: string,
 *   sharedRoot?: string,
 * }} opts
 *   bundleRoot  — root of the installer bundle (contains orchestration.yml,
 *                 templates/, ui/)
 *   sharedRoot  — root of the shared-asset bundle for the UI; defaults to
 *                 bundleRoot
 * @returns {Promise<void>}
 */
export async function hydrateUserData(opts) {
  const { bundleRoot } = opts;
  const sharedRoot = opts.sharedRoot ?? bundleRoot;
  const paths = userDataPaths();

  // 1. Ensure ~/.radorch/ root exists.
  fs.mkdirSync(paths.root, { recursive: true });

  // 2. Create projects/ and logs/ idempotently — never touch their contents.
  fs.mkdirSync(paths.projects, { recursive: true });
  fs.mkdirSync(paths.logs, { recursive: true });

  // 3. orchestration.yml — copy only if absent (FR-14, AD-13).
  if (!fs.existsSync(paths.orchestrationYml)) {
    fs.copyFileSync(
      path.join(bundleRoot, 'orchestration.yml'),
      paths.orchestrationYml,
    );
  }

  // 4. templates/ — ensure dir, then overwrite shipped files; leave user-added
  //    files in place (FR-15, AD-13).
  fs.mkdirSync(paths.templates, { recursive: true });
  for (const filename of SHIPPED_TIER_FILES) {
    fs.copyFileSync(
      path.join(bundleRoot, 'templates', filename),
      path.join(paths.templates, filename),
    );
  }

  // 5. ui/ — atomic tmp-rename (FR-16, AD-9).
  //    Copy → wipe prior → rename. If the copy fails the prior ui/ is untouched.
  const tmp = paths.ui + '.tmp-' + process.pid;
  fs.rmSync(tmp, { recursive: true, force: true });             // clean any leftover tmp
  fs.cpSync(path.join(sharedRoot, 'ui'), tmp, { recursive: true }); // copy to tmp
  fs.rmSync(paths.ui, { recursive: true, force: true });        // wipe prior ui/
  fs.renameSync(tmp, paths.ui);                                 // atomic rename
}
