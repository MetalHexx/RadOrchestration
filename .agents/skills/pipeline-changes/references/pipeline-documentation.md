# Pipeline Documentation

What documentation to update after a pipeline change, and when to escalate instead.

## Update Matrix

| What Changed | Update These Docs |
|-------------|-------------------|
| Event vocabulary (new/renamed/removed event) | `docs/scripts.md` — event vocabulary table |
| Action routing (new/renamed/removed action) | `.claude/skills/rad-orchestration/references/action-event-reference.md` — action routing table + event signaling reference |
| State schema fields | `.claude/instructions/state-management.instructions.md` + `schemas/state-v4.schema.json` |
| Significant behavioral change | `docs/pipeline.md` + `README.md` (if it changes the high-level flow) |
| Pipeline internals (module structure, data flow) | `.agents/skills/pipeline-changes/references/pipeline-internals.md` |
| Change patterns or gotchas | `.agents/skills/pipeline-changes/references/pipeline-patterns.md` |

## Escalation

If the documentation update requires understanding context beyond the scope of your current task, **signal the Tactical Planner** to create a dedicated documentation task rather than doing it inline. Examples:

- Updating the README mermaid flow diagram after a structural change to the pipeline tiers
- Rewriting `docs/pipeline.md` sections that describe the full phase lifecycle
- Cross-referencing changes across multiple planning documents

For small, localized updates (adding a row to a table, updating a path), do it as part of your task.

## Self-Update Rule

If your change affects any pattern described in `pipeline-patterns.md` or any architecture described in `pipeline-internals.md`, **update those docs as part of your task**. This skill is only useful if it reflects the current state of the code.
