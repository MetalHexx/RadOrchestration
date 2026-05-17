import { ensureDir, writeFileAtomic } from './fs-helpers.js';
import { writeInstallJson, writeConfigYml } from './config.js';
import { writeRegistrySkeleton } from './registry.js';
import { installPaths } from './paths.js';
import type { HarnessName } from '../framework/harness.js';

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

export async function writeBaseFiles(root: string, harness: HarnessName): Promise<void> {
  const p = installPaths(root);
  await ensureDir(p.root);
  await writeConfigYml(p.configYml, { default_active_harness: harness });
  await writeRegistrySkeleton(p.registryYml);
  await writeFileAtomic(p.harnessPointer, harness + '\n');
  await writeFileAtomic(p.gitignore, GITIGNORE);
}

export async function writeInstallSkeleton(opts: {
  root: string;
  packageVersion: string;
  defaultHarness: HarnessName;
}): Promise<void> {
  const p = installPaths(opts.root);
  await ensureDir(p.root);
  await writeInstallJson(p.installJson, {
    package_version: opts.packageVersion,
    installed_at: new Date().toISOString(),
    last_writer_version: opts.packageVersion,
    state_schema_version: 'v5',
  });
  await writeBaseFiles(opts.root, opts.defaultHarness);
  await ensureDir(p.projectsDir);
  await ensureDir(p.worktreesDir);
  await ensureDir(p.logsDir);
}
