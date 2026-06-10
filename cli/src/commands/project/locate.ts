import { defineCommand } from '../../framework/command.js';
import { userDataPaths } from '../../lib/paths.js';
import { WorkGraphService } from '@rad-orchestration/work-graph';
import type { LocateResult } from '@rad-orchestration/work-graph';

export interface ProjectLocateOptions {
  cwd: string;
  locator?: (cwd: string) => LocateResult;
}

export function projectLocate({ cwd, locator }: ProjectLocateOptions): LocateResult {
  const fn = locator ?? ((c: string) => {
    const paths = userDataPaths();
    return new WorkGraphService({ root: paths.root, worktreesDir: paths.worktrees, sideProjectsDir: paths.sideProjects }).locate(c);
  });
  return fn(cwd);
}

export const projectLocateCommand = defineCommand({
  name: 'project-locate',
  description: 'Classify the current working directory against worktrees, side-projects, and the repo registry',
  args: {},
  flags: {},
  handler: async () => {
    const r = projectLocate({ cwd: process.cwd() });
    return r;
  },
  mapResult: (r) => ({ ok: true, data: r }),
});
