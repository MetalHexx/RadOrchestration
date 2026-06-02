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
         addRepo, editRepo, removeRepo, bindRepo, createGroup, editGroup,
         addGroupMember, removeGroupMember, deleteGroup
       } from '@rad-orchestration/repo-registry';
```

| Export | Signature | Description |
|--------|-----------|-------------|
| `readRegistry` | `({ root }) => Registry` | Reads both files; returns empty maps when absent |
| `writeIdentity` | `({ root, repos, repoGroups }) => void` | Atomically writes `repo-registry.yml`. **Low-level — for the mutations below and test fixtures only; never called by consumer/command code (see the seam rule).** |
| `writeLocal` | `({ root, localPaths }) => void` | Atomically writes `repo-registry.local.yml` and calls `ensureLocalGitignored`. **Low-level — mutations/fixtures only (see the seam rule).** |
| `ensureLocalGitignored` | `({ root }) => void` | Idempotently adds entry to `.gitignore`. **Low-level — mutations/fixtures only (see the seam rule).** |
| `isSlug` | `(name: string) => boolean` | Returns true if name matches lowercase-kebab pattern `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `assertUniqueName` | `(reg: Registry, name: string) => void` | Throws if name already exists as a repo or repo-group |
| `resolveRepoPath` | `(reg: Registry, name: string) => Resolved` | Returns bound local path or an unbound hint; see `Resolved` type |
| `Resolved` | `{ name, bound, path, hint }` | Result type for `resolveRepoPath`; `bound` is true when a local path is registered |
| `addRepo` | `(AddRepoOpts) => void` | Validates slug, asserts uniqueness, then writes repo identity and local path |
| `editRepo` | `(EditRepoOpts) => RepoIdentity` | Updates a repo's description/remote/default branch (only the fields supplied); throws if the repo does not exist |
| `removeRepo` | `(RemoveRepoOpts) => void` | Removes repo from identity, local paths, and all group memberships |
| `bindRepo` | `(BindRepoOpts) => void` | Sets a repo's local clone path; throws if the repo does not exist |
| `createGroup` | `(CreateGroupOpts) => void` | Validates slug, asserts uniqueness, then creates a new repo-group |
| `editGroup` | `(EditGroupOpts) => void` | Updates a repo-group's description; throws if the group does not exist |
| `addGroupMember` | `(GroupMemberOpts) => void` | Adds repo to group members (idempotent); throws if group does not exist |
| `removeGroupMember` | `(GroupMemberOpts) => void` | Removes repo from group members; no-op if repo is not a member |
| `deleteGroup` | `(DeleteGroupOpts) => void` | Deletes a repo-group (member repos are unaffected) |
| `AddRepoOpts` | `{ root, name, identity, localPath }` | Options for `addRepo` |
| `EditRepoOpts` | `{ root, name, description?, remote?, defaultBranch? }` | Options for `editRepo` |
| `RemoveRepoOpts` | `{ root, name }` | Options for `removeRepo` |
| `BindRepoOpts` | `{ root, name, localPath }` | Options for `bindRepo` |
| `CreateGroupOpts` | `{ root, name, members, description? }` | Options for `createGroup` |
| `EditGroupOpts` | `{ root, name, description }` | Options for `editGroup` |
| `GroupMemberOpts` | `{ root, group, repo }` | Options for `addGroupMember` / `removeGroupMember` |
| `DeleteGroupOpts` | `{ root, name }` | Options for `deleteGroup` |

**Mutation seam (hard rule).** Every semantic write is a named mutation here. The raw `writeIdentity` / `writeLocal` writers are low-level building blocks for *these* mutations and for test fixtures — consumer/command code must never call them directly. See `cli/AGENTS.md` and the `registry-mutation-seam` enforcement test.

## Running tests

```
npm test
```
