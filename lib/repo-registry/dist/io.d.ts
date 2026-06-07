import type { Registry, RepoIdentity, RepoGroup } from './types.js';
export declare function readRegistry({ root }: {
    root: string;
}): Registry;
export declare function writeIdentity({ root, repos, repoGroups }: {
    root: string;
    repos: Record<string, RepoIdentity>;
    repoGroups: Record<string, RepoGroup>;
}): void;
export declare function writeLocal({ root, localPaths }: {
    root: string;
    localPaths: Record<string, string>;
}): void;
export declare function ensureGitignored({ root, entry }: {
    root: string;
    entry: string;
}): void;
export declare function ensureLocalGitignored({ root }: {
    root: string;
}): void;
