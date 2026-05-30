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
import { readRegistry, writeIdentity, writeLocal, ensureLocalGitignored } from '@rad-orchestration/repo-registry';
```

| Export | Signature | Description |
|--------|-----------|-------------|
| `readRegistry` | `({ root }) => Registry` | Reads both files; returns empty maps when absent |
| `writeIdentity` | `({ root, repos, repoGroups }) => void` | Atomically writes `repo-registry.yml` |
| `writeLocal` | `({ root, localPaths }) => void` | Atomically writes `repo-registry.local.yml` and calls `ensureLocalGitignored` |
| `ensureLocalGitignored` | `({ root }) => void` | Idempotently adds entry to `.gitignore` |

## Running tests

```
npm test
```
