# action-events/custom overlay

Project teams drop files here to extend the shipped catalog without modifying the versioned entries in the parent folder. The loader merges custom content at startup — no service restart is needed (NFR-6 cold-read guarantee).

## Slot shapes

Three slot shapes are recognized:

- **`action.<name>.pre.md`** — prepended instruction prose injected before the shipped action body when the pipeline renders action context for an agent.
- **`event.<name>.pre.md`** — prepended instruction prose injected before the shipped event body when the pipeline renders event context.
- **`event.<name>.post.md`** — appended instruction prose injected after the shipped event body.

Each slot file uses the same frontmatter contract as its parent catalog entry (same `kind`, `name`, `title`, `description`) so the validator can confirm the slot targets a real catalog entry (FR-9).

## Anchor rationale

Slots are anchored to catalog entries by `kind` + `name` (DD-2). This keeps custom overlays stable across catalog version upgrades: renaming a catalog entry intentionally breaks the overlay so authors notice, rather than silently orphaning customizations.

## Authoring guidance

Write slot bodies in instruction voice — tell the agent what to do, not what the action is (FR-16). The pipeline engine concatenates slot bodies with the shipped catalog body before passing context to the agent; prose that describes rather than instructs adds noise without value.

## Validation

On load the validator checks that every custom slot references an existing catalog `kind` + `name` pair. Unknown targets are rejected with a clear error rather than silently ignored (FR-9).
