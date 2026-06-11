import type { WorktreeRef } from '../types.js';
export type GitExec = (file: string, args: string[], opts: {
    cwd?: string;
}) => string;
export interface ResolveDeps {
    projectsDir: string;
    worktreesDir: string;
    sideProjectsDir?: string;
    exec?: GitExec;
}
export declare function resolveWorktrees(projectName: string, deps: ResolveDeps): WorktreeRef[];
