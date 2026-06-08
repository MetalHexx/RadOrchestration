import { defineCommand } from '../../framework/command.js';
import { userDataPaths } from '../../lib/paths.js';
import { WorkGraphService } from '@rad-orchestration/work-graph';
import { readConfig } from '../config/index.js';
import { renderPreamble } from './render.js';
import { resolveYouAreIn } from './resolve.js';

export const sessionContextCommand = defineCommand({
  name: 'session-context',
  description: 'Rendered session preamble for orchestrator session initialization',
  args: {},
  flags: {},
  handler: async () => {
    const root = userDataPaths().root;
    const svc = new WorkGraphService({ root });
    const projects = svc.listProjects({ status: 'in_progress' });
    const active = projects.map((p) => ({ name: p.name, tier: p.tier }));
    const withWorktrees = projects.map((p) => ({ name: p.name, worktrees: svc.resolveWorktrees(p.id) }));
    const youAreIn = resolveYouAreIn({ cwd: process.cwd(), active: withWorktrees });
    const config = readConfig({ root });
    return { preamble: renderPreamble({ root, active, config, youAreIn }) };
  },
});
