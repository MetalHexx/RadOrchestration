## Upgrading from `v1.0.0-alpha.7` (multi-harness restructure)

This release introduces multi-harness support. The installer now ships
per-harness bundles instead of a single `.claude/` bundle.

**Orphan-file risk:** files that came from the previous installer's
`.claude/` bundle but are not re-emitted by the new per-harness bundle
remain on disk as orphans. Recommended migration: back up local edits in
your installed `.claude/` folder, delete it, and re-run the installer.
Surgical orphan detection ships in MULTI-HARNESS-2.
