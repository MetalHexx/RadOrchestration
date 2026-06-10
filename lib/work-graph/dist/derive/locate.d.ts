import type { GitExec } from './worktrees.js';
export type LocateKind = 'worktree' | 'main-clone' | 'side-project' | 'none';
export interface LocateResult {
    kind: LocateKind;
    /** Set when kind is 'worktree' or 'side-project' */
    worktree_name?: string;
    /** Set when kind is 'worktree' or 'main-clone' */
    repo?: string;
    /** Set when kind is 'worktree' — project folder names whose resolved worktree_name matches */
    projects?: string[];
    /** Set when kind is 'worktree' — branch of the worktree dir from git worktree list */
    branch?: string | null;
}
export interface LocateDeps {
    projectsDir: string;
    worktreesDir: string;
    sideProjectsDir: string;
    /** Map of repo name → absolute local path (from the registry) */
    registryLocalPaths: Record<string, string>;
    /** Optional git executor, defaults to execFileSync */
    exec?: GitExec;
}
/**
 * Returns true when `child` is the same as or nested under `parent`.
 * Moved here from cli/src/commands/session-context/resolve.ts to share with
 * the locate classifier (AD-7).
 */
export declare function within(parent: string, child: string): boolean;
/**
 * Classify a cwd path against the known directory conventions and registry.
 *
 * Classification order (first match wins):
 *   1. cwd is within worktreesDir → kind=worktree
 *   2. cwd is within sideProjectsDir → kind=side-project
 *   3. cwd matches or nests under a registryLocalPaths entry → kind=main-clone
 *   4. → kind=none
 *
 * Read-only: never writes state, never reads a stored absolute path (NFR-1, NFR-4).
 */
export declare function locate(cwd: string, deps: LocateDeps): LocateResult;
