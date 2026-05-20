// harness-dogfood/user-data-paths.js — Resolves ~/.radorch/ and the minimum
// set of subpaths the in-folder dogfood library consumes (root, projects,
// templates). Decoupled from installer/lib/install/ per AD-2 — the dogfood
// loop does not need install.json, doctor-surface fields, or any other
// installer-only paths.

import os from 'node:os';
import path from 'node:path';

export function userDataPaths() {
  const root = path.join(os.homedir(), '.radorch');
  return {
    root,
    projects: path.join(root, 'projects'),
    templates: path.join(root, 'templates'),
  };
}
