import { within } from '@rad-orchestration/work-graph';

export interface ActiveWorktrees { name: string; worktrees: { path: string }[]; }
export interface ResolveYouAreInOpts { cwd: string; active: ActiveWorktrees[]; }

export function resolveYouAreIn({ cwd, active }: ResolveYouAreInOpts): string | undefined {
  for (const p of active) {
    for (const w of p.worktrees) {
      if (w.path && within(w.path, cwd)) return p.name;
    }
  }
  return undefined;
}
