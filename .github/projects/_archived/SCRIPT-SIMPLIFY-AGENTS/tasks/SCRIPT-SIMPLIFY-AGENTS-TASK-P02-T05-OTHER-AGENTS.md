---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 2
task: 5
title: "Other Agent Updates + triage-report Deletion"
status: "pending"
skills_required: ["generate-task-report"]
skills_optional: ["run-tests"]
estimated_files: 8
---

# Other Agent Updates + triage-report Deletion

## Objective

Update 6 agent definition files (brainstormer, research, product-manager, ux-designer, architect, coder) to remove `STATUS.md` references and outdated "only the Tactical Planner" sole-writer language, replacing it with pipeline-script-based state authority language. Delete the entire `.github/skills/triage-report/` directory since triage is now handled internally by the pipeline engine.

## Context

The orchestration system has been refactored so that no agent directly writes `state.json` — all state mutations now flow through the pipeline script (`pipeline.js`). The `STATUS.md` artifact has been eliminated entirely. Six agent definition files still contain the old language pattern: `Write to state.json or STATUS.md — only the Tactical Planner does that`. These must be updated to reflect the new architecture. The `triage-report` skill is obsolete because triage logic is now executed deterministically inside the pipeline engine, not by agents reading decision tables. The Brainstormer agent also references the Tactical Planner as the agent that creates project subdirectories during init — this is now handled by the pipeline script.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/agents/research.agent.md` | Update sole-writer / STATUS.md language |
| MODIFY | `.github/agents/product-manager.agent.md` | Update sole-writer / STATUS.md language |
| MODIFY | `.github/agents/ux-designer.agent.md` | Update sole-writer / STATUS.md language |
| MODIFY | `.github/agents/architect.agent.md` | Update sole-writer / STATUS.md language |
| MODIFY | `.github/agents/coder.agent.md` | Update sole-writer / STATUS.md language |
| MODIFY | `.github/agents/brainstormer.agent.md` | Update sole-writer / STATUS.md language + init subdirectory language |
| DELETE | `.github/skills/triage-report/SKILL.md` | Delete — triage now handled by pipeline engine |
| DELETE | `.github/skills/triage-report/templates/` | Delete — empty directory, part of triage-report skill |

## Implementation Steps

1. **Modify `research.agent.md`**: In the "What you do NOT do" section, find the line `- Write to \`state.json\` or \`STATUS.md\` — only the Tactical Planner does that` and replace it with `- Write to \`state.json\` — no agent directly writes \`state.json\`; all state mutations flow through the pipeline script`. Verify no other `STATUS.md` references exist in the file.

2. **Modify `product-manager.agent.md`**: Same change as step 1 — find and replace the identical sole-writer / STATUS.md line in the "What you do NOT do" section.

3. **Modify `ux-designer.agent.md`**: Same change as step 1 — find and replace the identical sole-writer / STATUS.md line in the "What you do NOT do" section.

4. **Modify `architect.agent.md`**: Same change as step 1 — find and replace the identical sole-writer / STATUS.md line in the "What you do NOT do" section.

5. **Modify `coder.agent.md`**: Same change as step 1 — find and replace the identical sole-writer / STATUS.md line in the "What you do NOT do" section.

6. **Modify `brainstormer.agent.md`**: Apply TWO changes:
   - (a) In the "What you do NOT do" section, find `- Write to \`state.json\` or \`STATUS.md\` — only the Tactical Planner does that` and replace with `- Write to \`state.json\` — no agent directly writes \`state.json\`; all state mutations flow through the pipeline script`.
   - (b) In the same section, find `- Create subfolders (\`phases/\`, \`tasks/\`, \`reports/\`) — the Tactical Planner does that during init` and replace with `- Create subfolders (\`phases/\`, \`tasks/\`, \`reports/\`) — the pipeline script creates these during project initialization`.

7. **Delete the `triage-report` skill directory**: Delete `.github/skills/triage-report/SKILL.md` and the empty `.github/skills/triage-report/templates/` directory. Remove the entire `.github/skills/triage-report/` directory tree.

8. **Verify all changes**: Grep all 6 modified agent files for `STATUS.md` — expect zero matches. Grep all 6 for `only the Tactical Planner` — expect zero matches. Confirm `.github/skills/triage-report/` does not exist.

## Contracts & Interfaces

No code contracts apply to this task — all changes are to Markdown agent definition files. The key constraint is the exact replacement text:

**Old pattern** (appears once in each of 6 agent files):
```
- Write to `state.json` or `STATUS.md` — only the Tactical Planner does that
```

**New replacement** (identical across all 6 files):
```
- Write to `state.json` — no agent directly writes `state.json`; all state mutations flow through the pipeline script
```

**Brainstormer additional old pattern**:
```
- Create subfolders (`phases/`, `tasks/`, `reports/`) — the Tactical Planner does that during init
```

**Brainstormer additional replacement**:
```
- Create subfolders (`phases/`, `tasks/`, `reports/`) — the pipeline script creates these during project initialization
```

## Styles & Design Tokens

Not applicable — no UI components in this task.

## Test Requirements

- [ ] Run the full test suite to confirm zero regressions (all 321 tests should pass)
- [ ] Grep `.github/agents/research.agent.md` for `STATUS.md` — expect 0 matches
- [ ] Grep `.github/agents/product-manager.agent.md` for `STATUS.md` — expect 0 matches
- [ ] Grep `.github/agents/ux-designer.agent.md` for `STATUS.md` — expect 0 matches
- [ ] Grep `.github/agents/architect.agent.md` for `STATUS.md` — expect 0 matches
- [ ] Grep `.github/agents/coder.agent.md` for `STATUS.md` — expect 0 matches
- [ ] Grep `.github/agents/brainstormer.agent.md` for `STATUS.md` — expect 0 matches
- [ ] Grep all 6 agent files for `only the Tactical Planner` — expect 0 matches across all files
- [ ] Verify `.github/skills/triage-report/` directory does not exist (neither SKILL.md nor templates/)

## Acceptance Criteria

- [ ] `research.agent.md` contains "no agent directly writes `state.json`; all state mutations flow through the pipeline script" in "What you do NOT do"
- [ ] `research.agent.md` has zero occurrences of `STATUS.md`
- [ ] `product-manager.agent.md` contains "no agent directly writes `state.json`; all state mutations flow through the pipeline script" in "What you do NOT do"
- [ ] `product-manager.agent.md` has zero occurrences of `STATUS.md`
- [ ] `ux-designer.agent.md` contains "no agent directly writes `state.json`; all state mutations flow through the pipeline script" in "What you do NOT do"
- [ ] `ux-designer.agent.md` has zero occurrences of `STATUS.md`
- [ ] `architect.agent.md` contains "no agent directly writes `state.json`; all state mutations flow through the pipeline script" in "What you do NOT do"
- [ ] `architect.agent.md` has zero occurrences of `STATUS.md`
- [ ] `coder.agent.md` contains "no agent directly writes `state.json`; all state mutations flow through the pipeline script" in "What you do NOT do"
- [ ] `coder.agent.md` has zero occurrences of `STATUS.md`
- [ ] `brainstormer.agent.md` contains "no agent directly writes `state.json`; all state mutations flow through the pipeline script" in "What you do NOT do"
- [ ] `brainstormer.agent.md` has zero occurrences of `STATUS.md`
- [ ] `brainstormer.agent.md` subdirectory line references the pipeline script, not the Tactical Planner
- [ ] No agent definition file in `.github/agents/` contains the phrase "only the Tactical Planner does that"
- [ ] `.github/skills/triage-report/` directory does not exist (fully deleted — SKILL.md, templates/, and directory itself)
- [ ] All existing test suites pass (321 tests, 0 regressions)
- [ ] Build check passes (no syntax errors, all files parse correctly)
- [ ] No content outside the targeted lines has been altered in any agent file (frontmatter, tools, workflows, skills, output contracts, quality standards all preserved)

## Constraints

- Do NOT modify the frontmatter (YAML header between `---` lines) of any agent file
- Do NOT modify the `tools:` or `agents:` lists in any agent file
- Do NOT change any content in the Workflow, Skills, Output Contract, or Quality Standards sections — only the "What you do NOT do" section is modified
- Do NOT modify any other agent files beyond the 6 listed (orchestrator, tactical-planner, and reviewer were already updated in T02/T03/T04)
- Do NOT modify `state.json` — this task is agent definition + skill deletion only
- Do NOT create any new files — this task only modifies existing files and deletes the triage-report skill
- Do NOT modify any files under `.github/orchestration/scripts/` — no code changes in this task
