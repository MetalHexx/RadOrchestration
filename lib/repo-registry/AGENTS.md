# repo-registry

Pure path-injected ESM seam for reading and writing the two-file registry format used by `~/.radorc/`.

## Seam contract

- **Consumed only through `src/index.ts`** — never reach into `src/io.ts` or `src/types.ts` directly.
- **Path-injected** — every function accepts `{ root: string }` so the caller supplies the `~/.radorc` directory; no global path lookups inside this module.
- **No side effects at import** — all I/O is deferred to function calls.

## Two-file model

| File | Purpose |
|------|---------|
| `repo-registry.yml` | Identity data: `repos` and `repo_groups` maps, committed to version control |
| `repo-registry.local.yml` | Local machine paths only (`paths` map), gitignored |

`repo-registry.local.yml` is created **lazily** — only when `writeLocal` is called. `repo-registry.yml` is created lazily by `writeIdentity`. Reading either absent file returns empty maps with no error.

## Atomic-write contract

All writes go to a sibling `.tmp` file followed by `fs.renameSync` over the target. No partial writes are observable on disk. No `.tmp` residue is left after a successful write.

## Gitignore maintenance

`ensureLocalGitignored({ root })` appends `repo-registry.local.yml` to `<root>/.gitignore` exactly once. Calling it multiple times is safe (idempotent).

## Public API

```
import { readRegistry, writeIdentity, writeLocal, ensureLocalGitignored,
         isSlug, assertUniqueName, resolveRepoPath,
         addRepo, removeRepo, createGroup, addGroupMember, removeGroupMember, deleteGroup
       } from '@rad-orchestration/repo-registry';
```

| Export | Signature | Description |
|--------|-----------|-------------|
| `readRegistry` | `({ root }) => Registry` | Reads both files; returns empty maps when absent |
| `writeIdentity` | `({ root, repos, repoGroups }) => void` | Atomically writes `repo-registry.yml` |
| `writeLocal` | `({ root, localPaths }) => void` | Atomically writes `repo-registry.local.yml` and calls `ensureLocalGitignored` |
| `ensureLocalGitignored` | `({ root }) => void` | Idempotently adds entry to `.gitignore` |
| `isSlug` | `(name: string) => boolean` | Returns true if name matches lowercase-kebab pattern `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `assertUniqueName` | `(reg: Registry, name: string) => void` | Throws if name already exists as a repo or repo-group |
| `resolveRepoPath` | `(reg: Registry, name: string) => Resolved` | Returns bound local path or an unbound hint; see `Resolved` type |
| `Resolved` | `{ name, bound, path, hint }` | Result type for `resolveRepoPath`; `bound` is true when a local path is registered |
| `addRepo` | `(AddRepoOpts) => void` | Validates slug, asserts uniqueness, then writes repo identity and local path |
| `removeRepo` | `(RemoveRepoOpts) => void` | Removes repo from identity, local paths, and all group memberships |
| `createGroup` | `(CreateGroupOpts) => void` | Validates slug, asserts uniqueness, then creates a new repo-group |
| `addGroupMember` | `(GroupMemberOpts) => void` | Adds repo to group members (idempotent); throws if group does not exist |
| `removeGroupMember` | `(GroupMemberOpts) => void` | Removes repo from group members; no-op if repo is not a member |
| `deleteGroup` | `(DeleteGroupOpts) => void` | Deletes a repo-group (member repos are unaffected) |
| `AddRepoOpts` | `{ root, name, identity, localPath }` | Options for `addRepo` |
| `RemoveRepoOpts` | `{ root, name }` | Options for `removeRepo` |
| `CreateGroupOpts` | `{ root, name, members, description? }` | Options for `createGroup` |
| `GroupMemberOpts` | `{ root, group, repo }` | Options for `addGroupMember` / `removeGroupMember` |
| `DeleteGroupOpts` | `{ root, name }` | Options for `deleteGroup` |

## Running tests

```
npm test
```
