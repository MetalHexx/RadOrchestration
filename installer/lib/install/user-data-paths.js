// installer/lib/install/user-data-paths.js — Resolves ~/.radorch/ and its
// known subpaths. Independent JS port of cli/src/lib/upgrade/user-data-paths.ts;
// kept in lockstep with that module (no shared imports).

import os from 'node:os';
import path from 'node:path';

export function userDataPaths() {
  const root = path.join(os.homedir(), '.radorch');
  return {
    root,
    installJson: path.join(root, 'install.json'),
    orchestrationYml: path.join(root, 'orchestration.yml'),
    ui: path.join(root, 'ui'),
    templates: path.join(root, 'templates'),
    projects: path.join(root, 'projects'),
    logs: path.join(root, 'logs'),
    runtime: path.join(root, 'runtime'),
    gitignore: path.join(root, '.gitignore'),
    harnessPointer: path.join(root, '.harness'),
    configYml: path.join(root, 'config.yml'),
    registryYml: path.join(root, 'registry.yml'),
  };
}
