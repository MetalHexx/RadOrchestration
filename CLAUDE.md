# Repository Coding Ruls:

- When making changes to the radorchestration pipeline and markdown files, do not leave requirements (FR-N, NFR-N, AD-N, DD-N) in the files.  These should only be used in project planning documents, not actual code or documentation.  The only exception is that we're making changes to the rad-create-plans or rad-code-review skills which leverage requirements as part of project planning and code review.

## Reserved Namespace: rad-*

The `rad-` prefix is reserved for skills shipped by the orchestration system. Do not author downstream skills under the `rad-*` name. The planner-spawn manifest filter (`list-repo-skills.mjs`) excludes them by design so they don't show up in the planner's "Repository Skills Available" surface.

When scaffolding a new skill, use the dev-only `rad-create-skill` tooling at `.agents/skills/rad-create-skill/` and pick a non-reserved name. Skills authored by downstream consumers should live under their own folder (or organisational namespace), not under `rad-`.


