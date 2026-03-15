---
project: "ORCHESTRATION-REORG"
phase: 3
task: 1
title: "Atomic Path Reference Cutover"
status: "pending"
skills_required: ["find-and-replace"]
skills_optional: []
estimated_files: 4
---

# Atomic Path Reference Cutover

## Objective

Replace all 15 stale `src/` script path references across 4 files with their `.github/orchestration/scripts/` equivalents. All 15 replacements MUST be applied as a single atomic unit — never leave partial stale references.

## Context

Phase 1 copied all CLI scripts and lib modules to `.github/orchestration/scripts/` (confirmed by Phase 1 Report). Phase 2 migrated all 307 tests to `.github/orchestration/scripts/tests/`. The old `src/` paths still work but the 4 files below reference the old locations. This task cuts over all references so the pipeline uses the new canonical paths exclusively.

## File Targets

| Action | Path | Replacements | Notes |
|--------|------|-------------|-------|
| MODIFY | `.github/agents/orchestrator.agent.md` | 4 | 2× `src/next-action.js`, 2× `src/triage.js` |
| MODIFY | `.github/agents/tactical-planner.agent.md` | 7 | 4× `src/validate-state.js`, 3× `src/triage.js` |
| MODIFY | `.github/instructions/state-management.instructions.md` | 3 | 3× `src/validate-state.js` |
| MODIFY | `.github/skills/triage-report/SKILL.md` | 1 | 1× `src/triage.js` |

## Implementation Steps

### Step 1: Modify `.github/agents/orchestrator.agent.md` (4 replacements)

Apply these exact string replacements:

**Replacement 1 — Line 131** (inside code block, Script Invocation section):
```
BEFORE: node src/next-action.js --state {base_path}/{PROJECT-NAME}/state.json --config .github/orchestration.yml
AFTER:  node .github/orchestration/scripts/next-action.js --state {base_path}/{PROJECT-NAME}/state.json --config .github/orchestration.yml
```

**Replacement 2 — Line 196** (inside `triage_task` row of action mapping table):
```
BEFORE: execute triage (call `node src/triage.js --level task`)
AFTER:  execute triage (call `node .github/orchestration/scripts/triage.js --level task`)
```

**Replacement 3 — Line 205** (inside `triage_phase` row of action mapping table):
```
BEFORE: execute triage (call `node src/triage.js --level phase`)
AFTER:  execute triage (call `node .github/orchestration/scripts/triage.js --level phase`)
```

**Replacement 4 — Line 220** (Post-Action Loop section):
```
BEFORE: 2. Call the script again: `node src/next-action.js --state {base_path}/{PROJECT-NAME}/state.json --config .github/orchestration.yml`
AFTER:  2. Call the script again: `node .github/orchestration/scripts/next-action.js --state {base_path}/{PROJECT-NAME}/state.json --config .github/orchestration.yml`
```

### Step 2: Modify `.github/agents/tactical-planner.agent.md` (7 replacements)

**Replacement 1 — Line 76** (Mode 2, step 4 — validate proposed state):
```
BEFORE: - Call: `node src/validate-state.js --current {state_path} --proposed {temp_path}`
AFTER:  - Call: `node .github/orchestration/scripts/validate-state.js --current {state_path} --proposed {temp_path}`
```

**Replacement 2 — Line 105** (Mode 3, step 7 — triage script phase-level):
```
BEFORE: - Call: `node src/triage.js --state {state_path} --level phase --project-dir {project_dir}`
AFTER:  - Call: `node .github/orchestration/scripts/triage.js --state {state_path} --level phase --project-dir {project_dir}`
```

**Replacement 3 — Line 131** (Mode 3, step 9 — validate proposed state):
```
BEFORE: - Call: `node src/validate-state.js --current {state_path} --proposed {temp_path}`
AFTER:  - Call: `node .github/orchestration/scripts/validate-state.js --current {state_path} --proposed {temp_path}`
```

**Replacement 4 — Line 147** (Mode 4, step 6 — triage script task-level):
```
BEFORE: - Call: `node src/triage.js --state {state_path} --level task --project-dir {project_dir}`
AFTER:  - Call: `node .github/orchestration/scripts/triage.js --state {state_path} --level task --project-dir {project_dir}`
```

**Replacement 5 — Line 178** (Mode 4, step 8 — validate proposed state):
```
BEFORE: - Call: `node src/validate-state.js --current {state_path} --proposed {temp_path}`
AFTER:  - Call: `node .github/orchestration/scripts/validate-state.js --current {state_path} --proposed {temp_path}`
```

**Replacement 6 — Line 215** (Mode 5, step 13 — validate proposed state):
```
BEFORE: - Call: `node src/validate-state.js --current {state_path} --proposed {temp_path}`
AFTER:  - Call: `node .github/orchestration/scripts/validate-state.js --current {state_path} --proposed {temp_path}`
```

**Replacement 7 — Line 225** (Skills section, triage-report bullet):
```
BEFORE: The authoritative executor is `src/triage.js`.
AFTER:  The authoritative executor is `.github/orchestration/scripts/triage.js`.
```

### Step 3: Modify `.github/instructions/state-management.instructions.md` (3 replacements)

**Replacement 1 — Line 42** (Pre-Write Validation section, prose):
```
BEFORE: The Tactical Planner MUST call `src/validate-state.js` before every `state.json` write. No exceptions.
AFTER:  The Tactical Planner MUST call `.github/orchestration/scripts/validate-state.js` before every `state.json` write. No exceptions.
```

**Replacement 2 — Line 47** (CLI Interface code block):
```
BEFORE: node src/validate-state.js --current <current-state.json> --proposed <proposed-state.json>
AFTER:  node .github/orchestration/scripts/validate-state.js --current <current-state.json> --proposed <proposed-state.json>
```

**Replacement 3 — Line 90** (Required Workflow step 3):
```
BEFORE: 3. Call: `node src/validate-state.js --current <path-to-current-state.json> --proposed <path-to-temp-file>`
AFTER:  3. Call: `node .github/orchestration/scripts/validate-state.js --current <path-to-current-state.json> --proposed <path-to-temp-file>`
```

### Step 4: Modify `.github/skills/triage-report/SKILL.md` (1 replacement)

**Replacement 1 — Line 8** (Execution Authority Notice blockquote):
```
BEFORE: The authoritative executor is `src/triage.js`.
AFTER:  The authoritative executor is `.github/orchestration/scripts/triage.js`.
```

### Step 5: Verify atomicity

After applying all 15 replacements, verify:
- Grep each file for `src/next-action.js`, `src/validate-state.js`, `src/triage.js` — expect 0 matches total
- Count new-path references per file: orchestrator = 4, tactical-planner = 7, state-management = 3, triage-report = 1

## Contracts & Interfaces

No code contracts apply — all 4 target files are Markdown (agent definitions, instructions, skill docs). The replacements are pure string substitutions within prose and code-block examples.

**Path replacement contract** (3 patterns):

| Old Path | New Path |
|----------|----------|
| `src/next-action.js` | `.github/orchestration/scripts/next-action.js` |
| `src/validate-state.js` | `.github/orchestration/scripts/validate-state.js` |
| `src/triage.js` | `.github/orchestration/scripts/triage.js` |

## Styles & Design Tokens

Not applicable — no UI components in scope.

## Test Requirements

- [ ] Grep `.github/agents/orchestrator.agent.md` for `src/next-action.js` — 0 matches
- [ ] Grep `.github/agents/orchestrator.agent.md` for `src/triage.js` — 0 matches
- [ ] Grep `.github/agents/tactical-planner.agent.md` for `src/validate-state.js` — 0 matches
- [ ] Grep `.github/agents/tactical-planner.agent.md` for `src/triage.js` — 0 matches
- [ ] Grep `.github/instructions/state-management.instructions.md` for `src/validate-state.js` — 0 matches
- [ ] Grep `.github/skills/triage-report/SKILL.md` for `src/triage.js` — 0 matches
- [ ] Count `.github/orchestration/scripts/next-action.js` in orchestrator.agent.md — exactly 2
- [ ] Count `.github/orchestration/scripts/triage.js` in orchestrator.agent.md — exactly 2
- [ ] Count `.github/orchestration/scripts/validate-state.js` in tactical-planner.agent.md — exactly 4
- [ ] Count `.github/orchestration/scripts/triage.js` in tactical-planner.agent.md — exactly 3
- [ ] Count `.github/orchestration/scripts/validate-state.js` in state-management.instructions.md — exactly 3
- [ ] Count `.github/orchestration/scripts/triage.js` in triage-report/SKILL.md — exactly 1
- [ ] Diff of each file shows ONLY path string changes — no other content modified

## Acceptance Criteria

- [ ] Zero occurrences of `src/next-action.js` in `.github/agents/orchestrator.agent.md`
- [ ] Zero occurrences of `src/triage.js` in `.github/agents/orchestrator.agent.md`
- [ ] Zero occurrences of `src/validate-state.js` in `.github/agents/tactical-planner.agent.md`
- [ ] Zero occurrences of `src/triage.js` in `.github/agents/tactical-planner.agent.md`
- [ ] Zero occurrences of `src/validate-state.js` in `.github/instructions/state-management.instructions.md`
- [ ] Zero occurrences of `src/triage.js` in `.github/skills/triage-report/SKILL.md`
- [ ] Exactly 4 new-path references in `.github/agents/orchestrator.agent.md` (2× next-action, 2× triage)
- [ ] Exactly 7 new-path references in `.github/agents/tactical-planner.agent.md` (4× validate-state, 3× triage)
- [ ] Exactly 3 new-path references in `.github/instructions/state-management.instructions.md` (3× validate-state)
- [ ] Exactly 1 new-path reference in `.github/skills/triage-report/SKILL.md` (1× triage)
- [ ] No other content in any file was modified (diff shows only path string changes)
- [ ] All 15 replacements applied as a single atomic unit — no partial state

## Constraints

- Do NOT modify any file content other than the specific path strings listed above
- Do NOT modify any files under `.github/projects/` (frozen artifact boundary)
- Do NOT modify the old `src/` files themselves — they remain for backward compatibility until Phase 5
- Do NOT introduce any new path patterns — use the exact new paths specified
- Do NOT reformat, re-wrap, or change whitespace in any line beyond the path substitution
- ATOMICITY: All 15 replacements must succeed together. If any single replacement fails, report the failure but do not leave partial changes — roll back that file
- Audit each file for `path.join`/`path.resolve`/`__dirname` runtime path construction patterns — these are Markdown files so none are expected, but if found, report them as anomalies in the task report
