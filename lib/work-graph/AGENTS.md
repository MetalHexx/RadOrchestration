# work-graph

The single backend for the work-graph CLI now and the dashboard UI later.

## Derive, don't duplicate

Only Groups and Edges are persisted. Everything else is derived live at read time and never written to disk.

| What | Where it lives | How it arrives |
|------|----------------|----------------|
| Groups | `~/.radorc/work-graph.yml` (`groups` map) | Stored — only the library (via `GraphIndex`) touches this file |
| Edges | `~/.radorc/work-graph.yml` (`edges` list) | Stored — same |
| Projects | `~/.radorc/projects/<id>/` directories | Derived from the filesystem at every read via `deriveProject` |
| Node status | `~/.radorc/projects/<id>/state.json` | Derived read-only from `state.json`; the library never writes it |
| Active set / worktree paths | Git worktree metadata + convention paths | Derived live via `resolveWorktrees`; never persisted |

## Seam rules

- **Only `GraphIndex` touches `work-graph.yml`.** No consumer outside this library reads or writes the store directly.
- **CLI and UI consume `WorkGraphService`.** They call the service methods; they never reach into `GraphIndex`, `WorkGraph`, or the derive helpers directly.
- **`state.json` is read-only.** This library reads `state.json` to derive project status. It never writes, migrates, or locks it.
- **Consumed only through `src/index.ts`.** Never import from internal modules (`store.js`, `graph.js`, `derive/*.js`, etc.) outside of this library.

## API surface

### Read

| Method | Signature | Description |
|--------|-----------|-------------|
| `getGraph` | `(scope?: { rootId?: NodeId; depth?: number }) => GraphDTO` | Returns the full `work-graph/v1` JSON projection; optionally scoped to a subtree |
| `getNode` | `(id: NodeId) => Node \| null` | Looks up a single node (project or group) by id |
| `listProjects` | `(filter?: { groupId?: NodeId; status?: NodeStatus }) => Project[]` | Lists all derived projects, with optional status or group membership filter |
| `listGroups` | `() => Group[]` | Lists all stored groups |
| `resolveWorktrees` | `(projectId: NodeId) => WorktreeRef[]` | Resolves worktree paths for a project via convention, shared-worktree-name, or git |

### Structure write

| Method | Signature | Description |
|--------|-----------|-------------|
| `createGroup` | `(input: { name: string; description: string; parentId?: NodeId }) => { node: Group; rev: number }` | Creates a new group; optionally nests it under a parent via a `contains` edge |
| `updateGroup` | `(id: NodeId, patch: { name?: string; description?: string }) => { node: Group; rev: number }` | Updates a group's name or description |
| `deleteGroup` | `(id: NodeId) => { rev: number }` | Deletes a group and cascades its `contains` edges; projects are never deleted |
| `addMember` | `(groupId: NodeId, nodeId: NodeId) => { edge: Edge; rev: number }` | Adds a `contains` edge from group to node |
| `removeMember` | `(groupId: NodeId, nodeId: NodeId) => { rev: number }` | Removes the `contains` edge between group and node |
| `link` | `(from: NodeId, to: NodeId, type: EdgeType) => { edge: Edge; rev: number }` | Adds an arbitrary typed edge |
| `unlink` | `(from: NodeId, to: NodeId, type: EdgeType) => { rev: number }` | Removes an arbitrary typed edge |

### Maintenance

| Method | Signature | Description |
|--------|-----------|-------------|
| `prune` | `() => { removed: Edge[]; rev: number }` | Removes edges whose `from` or `to` node no longer exists; no-op if nothing to remove |

## The `work-graph/v1` projection

`getGraph` returns a `GraphDTO` object that is the versioned consumer boundary — the shape CLI commands and the UI receive:

```ts
interface GraphDTO {
  schema: 'work-graph/v1'; // PROJECTION_SCHEMA constant
  nodes: Node[];            // groups + derived projects
  edges: Edge[];            // active edges (both endpoints exist)
  danglingEdges: Edge[];    // edges whose endpoint was not found in this read
}
```

`danglingEdges` is surfaced for diagnostic display; it is never silently dropped. Consumers should treat `schema` as a version discriminant and reject unrecognised values.

## Validation invariants

| Invariant | Where enforced |
|-----------|----------------|
| Referential integrity — both edge endpoints must exist at write time | `validateNewEdge` |
| No duplicate edges — same `(type, from, to)` triple is rejected | `validateNewEdge` |
| Single-parent containment — a node may have at most one `contains` parent | `validateNewEdge` |
| Acyclic containment — a `contains` edge that would form a cycle is rejected | `validateNewEdge` |
| Unique group ids — derived from `slugify(name)`; collision throws | `validateNewGroupId` |
| Overlay-only writes — projects are never created or deleted through the service | `WorkGraphService` (by design; no create/delete project methods) |
| Edge-type leniency — only `contains` edges are structurally constrained; other edge types (`spawned-from`, `follows`, and open-ended string types) are stored as-is | `validateNewEdge` |

Validation failures throw `GraphValidationError`. Stale-revision conflicts on concurrent writes throw `StaleRevisionError`.

For architecture depth — layering diagram, reconcile strategy, store format evolution — refer to the Technical Design document rather than this orientation file.

## Build and distribution

```
npm run build
```

This runs `tsc` and emits a compiled ESM `dist/` tree — `dist/index.js` (the module entry) plus `.d.ts` type declarations for every public export. The `package.json` `exports` map resolves `@rad-orchestration/work-graph` to `dist/index.js` (runtime) and `dist/index.d.ts` (types).

**Workspace consumption.** The root `package.json` declares this package as a workspace entry (`lib/work-graph`). After a root `npm install`, npm creates a symlink at `node_modules/@rad-orchestration/work-graph` pointing here. Consumers — the CLI and the UI — import this library by name (`@rad-orchestration/work-graph`) and resolve against the compiled `dist/` through that symlink. Neither consumer imports raw source directly.

## Running tests

```
npm test
```

This runs the vitest suites. Tests live in `tests/` and cover the store, derive helpers, graph traversal, validation, reconcile, and service facade layers.
