---
project: "STATE-TRANSITION-SCRIPTS"
phase: 4
task: 3
title: "Supporting Document Updates"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 2
---

# Supporting Document Updates

## Objective

Update the `triage-report` skill and `state-management` instructions to reflect the new script-based execution authority established in Phases 1–3. Add a documentation-only notice to the triage-report skill and a pre-write validation requirement to the state-management instructions.

## Context

The orchestration system now has three deterministic scripts: `src/validate-state.js` (state transition validator), `src/triage.js` (triage executor), and `src/next-action.js` (next-action resolver). The Orchestrator and Tactical Planner agents were rewritten in T1 and T2 to call these scripts. Two supporting documents still need updating to reflect this shift: the triage-report skill (which contains the decision tables the triage script implements) and the state-management instructions (which need to mandate the pre-write validation workflow).

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/skills/triage-report/SKILL.md` | Add execution authority notice after frontmatter/heading |
| MODIFY | `.github/instructions/state-management.instructions.md` | Add Pre-Write Validation section |

## Implementation Steps

1. **Open `.github/skills/triage-report/SKILL.md`**
2. **Insert the following notice block** immediately after the `# Triage Report` heading (before the paragraph starting "Triage task reports and review documents…"):

```markdown

> **⚠️ Execution Authority Notice**: The decision tables in this document are **documentation-only**. The authoritative executor is `src/triage.js`. The script implements the exact logic described in the tables below. These tables remain for human readability and as the specification the script was built from. Agents MUST call the script — do NOT interpret these tables directly.
```

3. **Do NOT modify any other content** in `SKILL.md` — the decision tables, state write contract, error handling, frontmatter, and all other sections must remain exactly as they are.

4. **Open `.github/instructions/state-management.instructions.md`**
5. **Append the following new section** at the end of the file (after the existing "Error Severity" section):

```markdown

## Pre-Write Validation

The Tactical Planner MUST call `src/validate-state.js` before every `state.json` write. No exceptions.

### CLI Interface

```
node src/validate-state.js --current <current-state.json> --proposed <proposed-state.json>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--current` | Yes | Path to the committed (current) `state.json` |
| `--proposed` | Yes | Path to the proposed (new) `state.json` |

### Output Format

The script emits JSON to stdout:

**On success** (exit code `0`):

```json
{
  "valid": true,
  "invariants_checked": 15
}
```

**On failure** (exit code `1`):

```json
{
  "valid": false,
  "invariants_checked": 15,
  "errors": [
    {
      "invariant": "V3",
      "message": "Task status transition not_started → complete is not allowed",
      "severity": "critical"
    }
  ]
}
```

### Required Workflow

Every `state.json` write in the Tactical Planner (Modes 2, 3, 4, and 5) must follow this sequence:

1. Prepare the proposed state as a complete JSON object
2. Write proposed state to a temporary file (e.g., `state.json.proposed`)
3. Call: `node src/validate-state.js --current <path-to-current-state.json> --proposed <path-to-temp-file>`
4. Parse JSON stdout: `result = JSON.parse(stdout)`
5. **If `result.valid === true`**: Commit — replace `state.json` with the proposed file
6. **If `result.valid === false`**: Do NOT commit the write. Record each entry from `result.errors` in `state.json → errors.active_blockers`. Halt the pipeline. Delete the temp file.

### Failure Behavior

On validation failure the Tactical Planner MUST:

- **NOT commit** the proposed `state.json` — the current state remains unchanged
- **Record each invariant violation** from `result.errors` into `errors.active_blockers`
- **Halt the pipeline** — set `pipeline.current_tier` to `"halted"`
- **Delete the temporary file** to avoid stale proposed states
- **Report the halt** in `STATUS.md` with the specific invariant violations
```

6. **Do NOT modify any existing content** in `state-management.instructions.md` — the existing sections (Sole Writer, Invariants, STATUS.md Rules, Pipeline Tiers, Error Severity) must remain exactly as they are.
7. **Verify** both files render as valid markdown with no broken fences or unclosed blocks.

## Contracts & Interfaces

### validate-state.js CLI Contract

```
Usage: node src/validate-state.js --current <path> --proposed <path>

Flags:
  --current   Path to committed state.json (required)
  --proposed  Path to proposed state.json (required)

Exit codes:
  0  Validation passed (valid: true)
  1  Validation failed or runtime error

Stdout (JSON):
  Success: { "valid": true, "invariants_checked": 15 }
  Failure: { "valid": false, "invariants_checked": 15, "errors": [ { "invariant": "V{N}", "message": "...", "severity": "critical" } ] }

Stderr:
  Runtime errors only (file not found, invalid JSON, missing flags)
```

### triage.js CLI Contract (reference only — not modified by this task)

```
Usage: node src/triage.js --state <path> --level task|phase --project-dir <dir>

Flags:
  --state        Path to state.json (required)
  --level        "task" or "phase" (required)
  --project-dir  Path to project directory (required)

Stdout (JSON):
  Success: { "success": true, "action": "advanced"|"corrective_task_issued"|"corrective_tasks_issued"|"halted", ... }
  Failure: { "success": false, "error": "..." }
```

## Styles & Design Tokens

Not applicable — markdown documentation files only.

## Test Requirements

- [ ] `.github/skills/triage-report/SKILL.md` contains the execution authority notice after the heading
- [ ] The notice text includes "documentation-only", "src/triage.js", and "authoritative executor"
- [ ] All existing decision tables in `SKILL.md` are unchanged (no content modifications)
- [ ] `.github/instructions/state-management.instructions.md` contains a "Pre-Write Validation" section
- [ ] The section documents `--current` and `--proposed` flags
- [ ] The section documents both success and failure JSON output formats
- [ ] The section documents the 6-step workflow (prepare → write temp → call → parse → commit or halt)
- [ ] The section documents failure behavior (do not commit, record errors, halt, delete temp)
- [ ] All existing content in `state-management.instructions.md` is unchanged
- [ ] Both files render as valid markdown (no broken fences, no unclosed blocks)

## Acceptance Criteria

- [ ] `triage-report/SKILL.md` includes notice that `src/triage.js` is the authoritative executor; tables are documentation-only
- [ ] `state-management.instructions.md` includes "Pre-Write Validation" section with CLI interface (`--current`, `--proposed` flags)
- [ ] `state-management.instructions.md` documents expected JSON output format (`valid`, `invariants_checked`, `errors[]`)
- [ ] `state-management.instructions.md` documents the required workflow: write to temp → validate → commit on valid → halt on invalid
- [ ] `state-management.instructions.md` documents failure behavior: do NOT commit, record errors in `errors.active_blockers`, halt pipeline
- [ ] Decision tables in `triage-report/SKILL.md` are NOT modified (content preserved exactly)
- [ ] Existing sections in `state-management.instructions.md` are NOT modified (content preserved exactly)
- [ ] Both files are valid markdown with no syntax errors

## Constraints

- Do NOT modify the decision tables in `triage-report/SKILL.md` — only add the notice
- Do NOT modify any existing sections in `state-management.instructions.md` — only append the new section
- Do NOT modify the YAML frontmatter in either file
- Do NOT create any new files — this task only modifies two existing files
- Do NOT reference external documents in the added content — all information must be self-contained within the additions
