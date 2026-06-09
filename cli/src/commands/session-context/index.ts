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
    // Worktree *paths* are derived from state.json + the worktree-name convention; only
    // branch/existence need git. The preamble uses paths only (for the "you're in" hint),
    // so pass a no-op exec to avoid spawning `git worktree list` per repo at session start.
    const svc = new WorkGraphService({ root, exec: () => '' });
    const projects = svc.listProjects({ status: 'in_progress' });
    const active = projects.map((p) => ({ name: p.name, tier: p.tier }));
    const withWorktrees = projects.map((p) => ({ name: p.name, worktrees: svc.resolveWorktrees(p.id) }));
    const youAreIn = resolveYouAreIn({ cwd: process.cwd(), active: withWorktrees });
    const config = readConfig({ root });
    return { preamble: renderPreamble({ root, active, config, youAreIn }) };
  },
});
