# action-events/custom overlay

Project teams drop files here to extend the shipped catalog without modifying the versioned entries in the parent folder. The composer cold-reads custom files on every envelope build, so edits take effect on the next pipeline event — no service restart is needed (NFR-6).

## Slot shapes

Three slot shapes are recognized:

- **`action.<name>.pre.md`** — prepended instruction prose injected before the shipped action body when the pipeline renders action context for an agent.
- **`event.<name>.pre.md`** — prepended instruction prose injected before the shipped event body when the pipeline renders event context.
- **`event.<name>.post.md`** — appended instruction prose injected after the shipped event body.

Slot files are markdown-only — do not include YAML frontmatter. The composer reads the file body verbatim and validates the target by filename (the `<name>` segment must match an existing `action.<name>.md` or `event.<name>.md` in the parent catalog folder; FR-9).

## Anchor rationale

Slots are anchored to catalog entries by `kind` + `name` (DD-2). This keeps custom overlays stable across catalog version upgrades: renaming a catalog entry intentionally breaks the overlay so authors notice, rather than silently orphaning customizations.

## Authoring guidance

Write slot bodies in instruction voice — tell the agent what to do, not what the action is (FR-16). The pipeline engine concatenates slot bodies with the shipped catalog body before passing context to the agent; prose that describes rather than instructs adds noise without value.

## Validation

On every envelope build the composer checks that any slot file it would compose references an existing catalog `kind` + `name` pair. Unknown targets are rejected with a clear error rather than silently ignored (FR-9). Files that no envelope ever consumes remain inert (AD-7).
