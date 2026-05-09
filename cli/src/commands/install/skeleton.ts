import { ensureDir, writeFileAtomic } from '../../lib/fs-helpers.js';
import { writeInstallJson, writeConfigYml } from '../../lib/config.js';
import { writeRegistrySkeleton } from '../../lib/registry.js';
import { installPaths } from '../../lib/paths.js';
import type { HarnessName } from '../../framework/harness.js';

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
  await writeConfigYml(p.configYml, { default_active_harness: opts.defaultHarness });
  await writeRegistrySkeleton(p.registryYml);
  await writeFileAtomic(p.harnessPointer, opts.defaultHarness + '\n');
  await writeFileAtomic(p.gitignore, GITIGNORE);
  await ensureDir(p.projectsDir);
  await ensureDir(p.worktreesDir);
  await ensureDir(p.logsDir);
}
