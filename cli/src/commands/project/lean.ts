import type { GraphDTO, Project, WorktreeRef } from '@rad-orchestration/work-graph';

export interface LeanWorktree { repo: string; path: string; branch: string | null; exists: boolean; }
export interface LeanProject {
  name: string; status: string; tier: string | null; sourceControlInitialized: boolean;
  dir: string; projectType?: 'side-project'; group?: string;
  worktrees: LeanWorktree[]; docs: Project['docs'];
  related: { follows?: string; spawned?: string[]; [k: string]: string | string[] | undefined };
}

export function toLeanProject(p: Project, graph: GraphDTO): LeanProject {
  const group = graph.edges.find((e) => e.type === 'contains' && e.to === p.id)?.from;
  const related: LeanProject['related'] = {};
  for (const e of graph.edges) {
    if (e.type === 'contains') continue;
    if (e.from === p.id) related[e.type] = e.to;            // outgoing: a single target
    else if (e.to === p.id) {
      const bucket = e.type === 'spawned-from' ? 'spawned' : `${e.type}-by`;
      if (!related[bucket]) related[bucket] = [];
      (related[bucket] as string[]).push(e.from);           // incoming: a list
    }
  }
  const lean: LeanProject = {
    name: p.name, status: p.status, tier: p.tier, sourceControlInitialized: p.sourceControlInitialized,
    dir: p.dir, docs: p.docs,
    worktrees: p.worktrees.map((w: WorktreeRef) => ({ repo: w.repo, path: w.path, branch: w.branch, exists: w.exists })),
    related,
  };
  if (p.projectType === 'side-project') lean.projectType = 'side-project';
  if (group) lean.group = group.replace(/^group:/, '');
  return lean;
}

export function renderProjectTable(projects: Project[]): string {
  const rows = projects.map((p) => `${p.name}\t${p.status}\t${p.tier ?? '-'}`);
  return ['NAME\tSTATUS\tTIER', ...rows].join('\n');
}
export function renderProjectCard(p: LeanProject): string {
  const lines = [`${p.name}  [${p.status}] tier=${p.tier ?? '-'}`, `dir: ${p.dir}`];
  if (p.group) lines.push(`group: ${p.group}`);
  for (const w of p.worktrees) lines.push(`worktree ${w.repo}: ${w.path} (${w.branch ?? 'detached'}) exists=${w.exists}`);
  return lines.join('\n');
}
