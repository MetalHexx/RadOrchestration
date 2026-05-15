// installer/lib/install/base-files.js — Writes the four base config files
// the orchestration system expects under ~/.radorch/: config.yml, registry.yml,
// .harness, .gitignore. Independent JS port of cli/src/commands/install/skeleton.ts
// (the writeBaseFiles function) plus helpers from cli/src/lib/config.ts +
// cli/src/lib/registry.ts.

import fs from 'node:fs';
import path from 'node:path';
import { userDataPaths } from './user-data-paths.js';

const GITIGNORE = `# radorch global install — versioned vs. gitignored paths
# Versioned (committed by radorch operations): install.json, registry.yml
# Gitignored:
config.yml
.harness
logs/
projects/
worktrees/
runtime/
`;

const REGISTRY_YML = `repos: []
workspaces: []
`;

function configYmlFor(harness) {
  return `default_active_harness: ${harness}\n`;
}

function writeFileAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * Writes the four base files to ~/.radorch/ (or to root if explicitly passed).
 * Idempotent: overwrites existing files. The shapes match what the in-skill CLI
 * writes via cli/src/commands/install/skeleton.ts so doctor's skeleton check
 * passes on installer-installed homes too.
 *
 * @param {string} root - Absolute path to the radorch user data root
 *   (typically ~/.radorch). Pass userDataPaths().root from a caller.
 * @param {string} harness - Active harness name; written into config.yml
 */
export function writeBaseFiles(root, harness) {
  fs.mkdirSync(root, { recursive: true });
  const paths = userDataPaths();
  // Path templates live in userDataPaths(); when caller passes a custom root
  // (e.g. tests with a tmp homedir), recompute under that root.
  const configYml = path.join(root, path.relative(paths.root, paths.configYml));
  const registryYml = path.join(root, path.relative(paths.root, paths.registryYml));
  const harnessPointer = path.join(root, path.relative(paths.root, paths.harnessPointer));
  const gitignore = path.join(root, path.relative(paths.root, paths.gitignore));

  writeFileAtomic(configYml, configYmlFor(harness));
  writeFileAtomic(registryYml, REGISTRY_YML);
  writeFileAtomic(harnessPointer, harness + '\n');
  writeFileAtomic(gitignore, GITIGNORE);
}
