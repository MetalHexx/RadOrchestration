import os from 'node:os';
import path from 'node:path';

export interface InstallPaths {
  readonly root: string;
  readonly installJson: string;
  readonly configYml: string;
  readonly registryYml: string;
  readonly harnessPointer: string;
  readonly gitignore: string;
  readonly projectsDir: string;
  readonly worktreesDir: string;
  readonly logsDir: string;
  readonly cliLog: string;
  readonly harnessesDir: string;
}

export function resolveInstallRoot(env: NodeJS.ProcessEnv = process.env): string {
  const override = env['RADORCH_HOME'];
  if (override && override.length > 0) return override;
  return path.join(os.homedir(), '.radorch');
}

export function installPaths(root: string): InstallPaths {
  const join = path.posix.join;
  return {
    root,
    installJson: join(root, 'install.json'),
    configYml: join(root, 'config.yml'),
    registryYml: join(root, 'registry.yml'),
    harnessPointer: join(root, '.harness'),
    gitignore: join(root, '.gitignore'),
    projectsDir: join(root, 'projects'),
    worktreesDir: join(root, 'worktrees'),
    logsDir: join(root, 'logs'),
    cliLog: join(root, 'logs', 'cli.log'),
    harnessesDir: join(root, 'runtime', 'harnesses'),
  };
}
