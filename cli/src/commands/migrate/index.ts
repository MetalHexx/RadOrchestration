/**
 * index.ts — migrate command registration.
 * Requirements: FR-15, FR-18, FR-19, NFR-5, AD-7, DD-2
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import type { CommandContext } from '../../framework/context.js';
import { migrateProject } from './migrate.js';
import type { MigrateProjectResult } from './migrate.js';

export interface MigrateCommandResult {
  results: Array<{ project: string; result: MigrateProjectResult }>;
}

interface Args { project?: string }
interface Flags { all?: boolean; 'dry-run'?: boolean }

export const migrateCommand = defineCommand<Args, Flags, MigrateCommandResult>({
  name: 'migrate',
  description: 'Migrate a project state.json to the current schema version',
  args: {
    project: { description: 'Project name (directory under ~/.radorc/projects)' },
  },
  flags: {
    all: { description: 'Migrate all projects found under the projects root', type: 'boolean' },
    'dry-run': { description: 'Report what would be migrated without writing', type: 'boolean' },
  },
  handler: async ({ args, flags }: { args: Args; flags: Flags; ctx: CommandContext }): Promise<MigrateCommandResult> => {
    const projectsRoot = userDataPaths().projects;
    const dryRun = Boolean(flags['dry-run']);
    const all = Boolean(flags['all']);

    if (!all && !args['project']) {
      throw new UserError('<project> argument is required unless --all is specified');
    }

    if (all) {
      // Discover all project directories under the projects root
      if (!fs.existsSync(projectsRoot)) {
        throw new UserError(`Projects root does not exist: ${projectsRoot}`);
      }
      const entries = fs.readdirSync(projectsRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('_'));

      const results: MigrateCommandResult['results'] = [];
      for (const entry of entries) {
        const projectDir = path.join(projectsRoot, entry.name);
        const statePath = path.join(projectDir, 'state.json');
        if (!fs.existsSync(statePath)) continue;
        try {
          const result = migrateProject({ projectDir, dryRun });
          results.push({ project: entry.name, result });
        } catch (err) {
          throw new Error(`migrate failed for project '${entry.name}': ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      return { results };
    }

    // Single project migration
    const projectName = args['project']!;
    const projectDir = path.join(projectsRoot, projectName);
    if (!fs.existsSync(path.join(projectDir, 'state.json'))) {
      throw new UserError(`No state.json found for project '${projectName}' at ${projectDir}`);
    }
    const result = migrateProject({ projectDir, dryRun });
    return { results: [{ project: projectName, result }] };
  },
  mapResult: (r: MigrateCommandResult) => ({
    ok: true,
    data: r,
    exit_code: 0,
  }),
});
