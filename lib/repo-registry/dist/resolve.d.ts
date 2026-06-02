import type { Registry } from './types.js';
export interface Resolved {
    name: string;
    bound: boolean;
    path: string | null;
    hint: string | null;
}
export declare function resolveRepoPath(reg: Registry, name: string): Resolved;
