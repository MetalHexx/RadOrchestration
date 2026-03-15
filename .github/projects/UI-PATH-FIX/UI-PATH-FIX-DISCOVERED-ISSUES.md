---
project: "UI-PATH-FIX"
type: "discovered-issues"
created: "2026-03-14T12:45:00Z"
author: "orchestrator"
---

# UI-PATH-FIX — Discovered Issues

Issues discovered during execution of the UI-PATH-FIX project. Items marked **IN-SCOPE** need to be addressed within this project. Items marked **OUT-OF-SCOPE** should be tracked for a future project.

---

## Issue 1: `phase_plan_created` requires tasks in context — no pre-read or auto-extraction

| Field | Value |
|-------|-------|
| **Scope** | OUT-OF-SCOPE |
| **Severity** | Medium |
| **Discovered During** | Orchestrator signaling `phase_plan_created` for P01 |
| **Affects** | All projects using the pipeline |

### Description

The pipeline's `handlePhasePlanCreated` mutation handler expects `context.tasks` to be an array of `{ id, title }` objects. If `context.tasks` is missing or empty, the handler silently creates a phase with zero tasks, causing the pipeline resolver to immediately skip to `generate_phase_report` (since "all tasks are complete" when there are none).

The Orchestrator must manually read the phase plan document, extract the task definitions, and include them in the `--context` JSON. Unlike `plan_approved` (which has a pre-read that extracts `total_phases` from the master plan), `phase_plan_created` has NO pre-read to auto-extract tasks from the phase plan document.

### Root Cause

The pipeline mutation handler is **passive** — it only processes what it receives in context. There is no `phase_plan_created` pre-read block in `pipeline-engine.js` that would read the phase plan document and extract task definitions automatically.

Compare:
- `plan_approved`: Has a pre-read that reads the master plan, extracts `total_phases` from frontmatter, and enriches context → fully automated
- `phase_plan_created`: No pre-read → Orchestrator must manually construct task array from the phase plan

### Impact

Every Orchestrator invocation must:
1. Read the phase plan document after the Tactical Planner creates it
2. Extract task IDs and titles from the document
3. Include them as `{"tasks": [...]}` in the `--context` payload

If the Orchestrator forgets or gets the format wrong, the phase initializes empty and the pipeline skips straight to phase report generation.

### Suggested Fix

Add a `phase_plan_created` pre-read block in `pipeline-engine.js` (similar to the `plan_approved` pre-read) that:
1. Reads the phase plan document from `context.plan_path`
2. Extracts task definitions from frontmatter (e.g., `tasks:` array in YAML) or from the document body
3. Enriches `context.tasks` before the mutation handler executes

This would make the pipeline self-sufficient and remove the burden from the Orchestrator.

---

## Issue 2: Triage engine and pre-reads crash on project-relative paths stored by T02 normalization

| Field | Value |
|-------|-------|
| **Scope** | IN-SCOPE (regression from T02) |
| **Severity** | Critical — blocks pipeline progression |
| **Discovered During** | Signaling `task_completed` for T02 |
| **Affects** | All projects after T02 normalization is deployed |
| **Error Log** | See UI-PATH-FIX-ERROR-LOG.md, Error 1 |

### Description

T02 added centralized path normalization (`normalizeContextPaths`) that strips workspace-relative prefixes from `context.*_path` fields before mutation handlers store them in `state.json`. This is correct for producing clean state — but the triage engine and pipeline pre-reads were not updated to handle the new path format.

The triage engine reads document paths from `state.json` fields (`task.report_doc`, `task.review_doc`, `phase.phase_review`) and calls `readDocument()` which resolves from CWD. Project-relative paths like `tasks/FILE.md` don't exist from the workspace root.

### Affected Consumers

| Consumer | Reads From State | Call |
|----------|-----------------|------|
| Triage (task-level) | `task.report_doc` | `readDocument(task.report_doc)` |
| Triage (task-level) | `task.review_doc` | `readDocument(task.review_doc)` |
| Triage (phase-level) | `phase.phase_review` | `readDocument(phase.phase_review)` |
| `plan_approved` pre-read | `state.planning.steps.master_plan.output` | `readDocument(masterPlanPath)` |

### Root Cause

1. **Research gap**: The research findings and architecture documents stated "pipeline reads state but does not consume stored doc paths" (PRD Risk 4 mitigation). This was incorrect — the triage engine IS a consumer of stored doc paths.
2. **Architecture gap**: `triage-engine.js` was marked as "Unchanged" in the module map and file structure.
3. **Design gap**: There is also a design mismatch in `triageTask` — it checks `if (!taskReport)` expecting `readDocument` to return `null` on missing files, but `readDocument` actually **throws** on missing files. Before T02, this never triggered because workspace-relative paths resolved correctly.

### Suggested Fix

In `pipeline-engine.js`, wrap `io.readDocument` with a project-aware resolver before passing to the triage engine:

```javascript
// Create a document reader that resolves project-relative paths
const projectAwareReader = (docPath) => {
  if (!docPath) return null;
  // Try the path as-is first (handles workspace-relative and absolute paths)
  try { return io.readDocument(docPath); } catch (_) {}
  // Fall back to resolving as project-relative
  const resolved = path.join(projectDir, docPath);
  return io.readDocument(resolved);
};

const triageResult = executeTriage(proposedState, level, projectAwareReader);
```

Apply the same pattern to the `plan_approved` pre-read:
```javascript
const masterPlanPath = state.planning.steps.master_plan.output;
// Resolve project-relative path if needed
const resolvedPath = fs.existsSync(masterPlanPath) 
  ? masterPlanPath 
  : path.join(projectDir, masterPlanPath);
const masterPlanDoc = io.readDocument(resolvedPath);
```

---

## Issue 3: `readDocument` throws instead of returning null — triage error handling mismatch

| Field | Value |
|-------|-------|
| **Scope** | OUT-OF-SCOPE (pre-existing, low priority) |
| **Severity** | Low |
| **Discovered During** | Root cause analysis of Issue 2 |
| **Affects** | Triage engine error handling |

### Description

`triageTask` and `triagePhase` check `if (!taskReport)` / `if (!codeReview)` after calling `readDocument()`, expecting a `null` return for missing files. However, `readDocument()` in `state-io.js` **throws** an error when a file doesn't exist rather than returning null. This means the null-check fallbacks in triage never trigger — errors always propagate as uncaught exceptions.

### Impact

The triage engine's graceful error paths (`makeError` with `DOCUMENT_NOT_FOUND`) are dead code — they can never execute. If a document is missing, the throw propagates up to the outer catch in `pipeline.js`, bypassing structured error reporting.

### Suggested Fix

Either:
- Wrap `readDocument` calls in triage with try-catch to convert throws to null returns
- Or change `readDocument` to return null for missing files (breaking change — would need audit of all call sites)

The wrapping approach is safer and non-breaking.

---

## Issue 4: V13 same-millisecond timing race in internal action loop

| Field | Value |
|-------|-------|
| **Scope** | IN-SCOPE (fixed during execution) |
| **Severity** | Critical — causes stuck state requiring manual recovery |
| **Discovered During** | Signaling `task_completed` for T02 |
| **Affects** | Any event that triggers triage + internal advance_task/advance_phase |
| **Error Log** | See UI-PATH-FIX-ERROR-LOG.md, Error 2 |

### Description

The internal action loop in `pipeline-engine.js` generates a new timestamp for each iteration via `new Date().toISOString()`. The V13 validator requires `project.updated` to be strictly newer than the previous snapshot. When the triage path writes state and the subsequent advance iteration generates a timestamp within the same millisecond, V13 rejects the write. The triage results are already persisted (state shows task as complete+approved) but the advance mutation is lost, leaving `current_task` pointing at a completed task.

### Root Cause

Sub-millisecond execution between `io.writeState` in the triage branch and `new Date().toISOString()` in the internal action loop produces identical ISO-8601 timestamps. V13's strict inequality check (`>`) rejects them.

### Fix Applied

In the internal action loop's "Common: re-validate, write, re-resolve" section, replaced:
```javascript
proposedState.project.updated = new Date().toISOString();
```
with:
```javascript
let advanceTs = Date.now();
const prevTs = new Date(preAdvanceState.project.updated).getTime();
if (advanceTs <= prevTs) advanceTs = prevTs + 1;
proposedState.project.updated = new Date(advanceTs).toISOString();
```

Also manually fixed stuck `state.json` by advancing `current_task` from 1 to 2.

---
