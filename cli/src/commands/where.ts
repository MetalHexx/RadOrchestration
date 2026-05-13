import { installPaths, resolveInstallRoot } from '../lib/paths.js';

export interface WhereName {
  description: string;
  resolve: (env: NodeJS.ProcessEnv) => string | { error: string };
}

export const WHERE_NAMES: Record<string, WhereName> = {
  projects: {
    description: 'Global projects folder (~/.radorch/projects).',
    resolve: () => installPaths(resolveInstallRoot()).projectsDir,
  },
  registry: {
    description: 'Workspace/repo registry file.',
    resolve: () => installPaths(resolveInstallRoot()).registryYml,
  },
  config: {
    description: 'Active-harness config file.',
    resolve: () => installPaths(resolveInstallRoot()).configYml,
  },
  root: {
    description: 'Radorch install root (~/.radorch).',
    resolve: () => installPaths(resolveInstallRoot()).root,
  },
  'install-json': {
    description: 'Install metadata (version, timestamp).',
    resolve: () => installPaths(resolveInstallRoot()).installJson,
  },
  logs: {
    description: 'Logs directory.',
    resolve: () => installPaths(resolveInstallRoot()).logsDir,
  },
  'plugin-root': {
    description: 'Plugin install root (CLAUDE_PLUGIN_ROOT env var).',
    resolve: (env) => env['CLAUDE_PLUGIN_ROOT'] ?? { error: 'CLAUDE_PLUGIN_ROOT is not set' },
  },
};

export const WHERE_DESCRIPTION =
  'Print the absolute path for a named radorch location. With no name, prints a `name  path` table for every supported lookup.';

export interface RunWhereOpts {
  name?: string;
  stdout: NodeJS.WriteStream;
  stderr: NodeJS.WriteStream;
  env: NodeJS.ProcessEnv;
}

export async function runWhere(opts: RunWhereOpts): Promise<number> {
  const { name, stdout, stderr, env } = opts;
  const names = Object.keys(WHERE_NAMES);

  if (!name) {
    const width = Math.max(...names.map((n) => n.length));
    for (const n of names) {
      const r = WHERE_NAMES[n].resolve(env);
      const value = typeof r === 'string' ? r : `<unset: ${r.error}>`;
      stdout.write(`${n.padEnd(width)}  ${value}\n`);
    }
    return 0;
  }

  if (!(name in WHERE_NAMES)) {
    stderr.write(`unknown: ${name}\n`);
    stderr.write(`names: ${names.join(', ')}\n`);
    return 1;
  }

  const result = WHERE_NAMES[name].resolve(env);
  if (typeof result === 'string') {
    stdout.write(`${result}\n`);
    return 0;
  }
  stderr.write(`${name}: ${result.error}\n`);
  return 1;
}

export function whereHelpText(): string {
  const names = Object.keys(WHERE_NAMES);
  const width = Math.max(...names.map((n) => n.length));
  const lines = names.map((n) => `  ${n.padEnd(width)}  ${WHERE_NAMES[n].description}`);
  return ['Names:', ...lines].join('\n');
}
