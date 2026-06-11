import type { Project } from '../types.js';
import { type GitExec } from './worktrees.js';
export interface DeriveDeps {
    projectsDir: string;
    worktreesDir: string;
    sideProjectsDir?: string;
    exec?: GitExec;
}
export declare function listProjectNames(projectsDir: string): string[];
export declare function projectExists(projectsDir: string, name: string): boolean;
export declare function deriveProject(name: string, deps: DeriveDeps): Project | null;
