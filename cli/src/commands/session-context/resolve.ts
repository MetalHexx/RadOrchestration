import path from 'node:path';

export interface ActiveWorktrees { name: string; worktrees: { path: string }[]; }
export interface ResolveYouAreInOpts { cwd: string; active: ActiveWorktrees[]; }

function within(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function resolveYouAreIn({ cwd, active }: ResolveYouAreInOpts): string | undefined {
  for (const p of active) {
    for (const w of p.worktrees) {
      if (w.path && within(w.path, cwd)) return p.name;
    }
  }
  return undefined;
}
