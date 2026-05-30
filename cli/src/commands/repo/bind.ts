import fs from 'node:fs';
import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { readRegistry, writeLocal } from '../../../../lib/repo-registry/src/index.js';
import type { CommandContext } from '../../framework/context.js';

export interface RepoBindOptions {
  root: string;
  name: string;
  repoPath: string;
}

export interface RepoBindResult {
  name: string;
  repoPath: string;
}

export function repoBind({ root, name, repoPath }: RepoBindOptions): RepoBindResult {
  // Check that the path is an existing directory
  if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
    throw new UserError(`path is not a directory: ${repoPath}`);
  }

  // Check that the name is registered in identity
  const reg = readRegistry({ root });
  if (!(name in reg.repos)) {
    throw new UserError(`repo '${name}' is not registered in the repo registry`);
  }

  // Write only the local path entry
  reg.localPaths[name] = repoPath;
  writeLocal({ root, localPaths: reg.localPaths });

  return { name, repoPath };
}

interface Args { name?: string; path?: string }

export const repoBindCommand = defineCommand({
  name: 'repo-bind',
  description: 'Bind a registered repo name to a local directory path',
  args: {
    name: { description: 'Registered repo name to bind', required: true },
    path: { description: 'Absolute path to the local directory for this repo', required: true },
  },
  flags: {},
  handler: async ({ args }: { args: Args; ctx: CommandContext }) => {
    const name = args.name;
    const repoPath = args.path;
    if (!name) throw new UserError('--name is required');
    if (!repoPath) throw new UserError('--path is required');
    const root = userDataPaths().root;
    return repoBind({ root, name, repoPath });
  },
});
