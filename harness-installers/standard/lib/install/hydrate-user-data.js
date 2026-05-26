// harness-installers/standard/lib/install/hydrate-user-data.js —
// Writes user-data files under ~/.radorc/ with the following preservation rules
// (AD-13 "sole-writer per file class"):
//
//   orchestration.yml  — copied only when absent (FR-14)
//   templates/         — shipped set (4 files) always overwritten; user-added
//                        templates preserved (FR-15, NFR-10)
//   ui/                — replaced atomically via tmp-rename (FR-16, AD-9)
//   projects/, logs/   — created if absent; existing contents never touched (FR-2)
//
// Pre-flight UI gate: if the dashboard UI is running, the rm-of-paths.ui below
// would EPERM on Windows. Stop it first; if the stop fails, throw UiLockError
// before any file work so the install can be retried cleanly.

import fs from 'node:fs';
import path from 'node:path';
import * as tar from 'tar';
import { userDataPaths } from './user-data-paths.js';
import { detectAndStopUi, formatUiLockMessage, UiLockError } from './ui-stop.js';

// The four shipped tier template filenames — constant, never derived from readdir.
const SHIPPED_TIER_FILES = ['extra-high.yml', 'high.yml', 'medium.yml', 'low.yml'];

/**
 * Hydrate the user-data directory (~/.radorc/) from the installer bundle.
 *
 * @param {{
 *   bundleRoot: string,
 *   sharedRoot?: string,
 *   _detectAndStopUi?: typeof detectAndStopUi,
 * }} opts
 *   bundleRoot  — root of the installer bundle (contains orchestration.yml,
 *                 templates/, ui/)
 *   sharedRoot  — root of the shared-asset bundle for the UI; defaults to
 *                 bundleRoot
 * @returns {Promise<{ uiStopped: boolean }>}
 */
export async function hydrateUserData(opts) {
  const { bundleRoot } = opts;
  const sharedRoot = opts.sharedRoot ?? bundleRoot;
  const detect = opts._detectAndStopUi ?? detectAndStopUi;
  const paths = userDataPaths();

  // Pre-flight UI gate. Runs before any file work so a stop-failure leaves
  // ~/.radorc/ untouched — install can be retried after the user kills the UI.
  const ui = await detect();
  if (ui.wasRunning && !ui.stopped) {
    throw new UiLockError(formatUiLockMessage(ui.status, ui.reason), ui.status);
  }

  // 1. Ensure ~/.radorc/ root exists.
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

  // 5. ui/ — atomic tmp-rename (FR-16, AD-9). UI ships as a gzipped tarball
  //    (ui.tgz) so node_modules/ and .next/ survive `npm pack`'s hardcoded
  //    node_modules strip. Extract to tmp → wipe prior → rename. If the
  //    extract fails the prior ui/ is untouched.
  const tmp = paths.ui + '.tmp-' + process.pid;
  fs.rmSync(tmp, { recursive: true, force: true });               // clean any leftover tmp
  fs.mkdirSync(tmp, { recursive: true });
  await tar.x({ file: path.join(sharedRoot, 'ui.tgz'), cwd: tmp }); // extract to tmp
  fs.rmSync(paths.ui, { recursive: true, force: true });          // wipe prior ui/
  fs.renameSync(tmp, paths.ui);                                   // atomic rename

  return { uiStopped: ui.stopped };
}
