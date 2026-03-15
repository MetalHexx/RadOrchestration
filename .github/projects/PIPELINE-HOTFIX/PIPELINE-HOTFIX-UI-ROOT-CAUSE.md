# PIPELINE-HOTFIX UI State Issues — Root Cause

## Issue 1: Unnamed Phases and Tasks

**Symptom**: All phases show as "Unnamed Phase" and all tasks show as "Unnamed Task" in the Execution Progress panel.

**Root Cause**: The `state.json` phase and task entries were bootstrapped manually (to work around the phase-initialization bug that PIPELINE-HOTFIX itself was fixing). The bootstrap script did not include `title`, `phase_number`, or `task_number` fields on phase and task objects.

The UI normalizer (`ui/lib/normalizer.ts`) renders:
- `raw.title ?? raw.name ?? 'Unnamed Phase'`
- `raw.title ?? raw.name ?? 'Unnamed Task'`

Because neither `title` nor `name` was present, both fell back to the "Unnamed" placeholder.

**Fix**: Add `title`, `phase_number`, and `task_number` fields to all phase and task entries in `state.json`. Also add `task_number` to tasks and `retries: 0, last_error: null, severity: null` to satisfy the `RawTask` interface.

---

## Issue 2: Document Links Return 404

**Symptom**: Clicking "Handoff", "Report", or "Phase Plan" document links shows a loading failure / 404 in the document drawer.

**Root Cause**: All document paths stored in `state.json` use **workspace-relative** format:
```
.github/projects/PIPELINE-HOTFIX/tasks/PIPELINE-HOTFIX-TASK-P01-T01.md
```

The UI's `resolveDocPath()` helper (`ui/lib/path-resolver.ts`) expects **project-relative** paths:
```
tasks/PIPELINE-HOTFIX-TASK-P01-T01.md
```

When called with a workspace-relative path, `path.resolve()` appends it verbatim onto the project directory, producing a **doubled path** that does not exist on disk:
```
{workspace}/.github/projects/PIPELINE-HOTFIX/.github/projects/PIPELINE-HOTFIX/tasks/...
```
This triggers `ENOENT` → 404 "Document not found".

**Fix**: Strip the `.github/projects/PIPELINE-HOTFIX/` prefix from all document paths in `state.json`, leaving only the project-relative remainder (e.g., `tasks/...`, `phases/...`, `PIPELINE-HOTFIX-PRD.md`).

---

## Systemic Note

Both issues are a consequence of the manual state bootstrapping required to run PIPELINE-HOTFIX despite the phase-initialization bug it was fixing. The bugfixes implemented in Phase 1 (Fix 1: `handlePlanApproved` phase initialization; Fix 2: resolver `execute_task` for in-progress tasks) prevent this situation from arising in future projects where the pipeline initializes state correctly from the master plan frontmatter. The path format mismatch is pre-existing in all projects and affects RAINBOW-HELLO and AMENDMENT as well.
