---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 2
task: 4
title: "Reviewer Agent + review-task Skill Rename"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 3
---

# Reviewer Agent + review-task Skill Rename

## Objective

Update the Reviewer agent definition to reference `review-task` instead of `review-code` and remove outdated sole-writer/`STATUS.md` language. Rename the `.github/skills/review-code/` directory to `.github/skills/review-task/` with updated frontmatter metadata. Preserve the `templates/CODE-REVIEW.md` template content unchanged.

## Context

The orchestration system has been refactored so that a unified pipeline script (`pipeline.js`) handles all state mutations, validation, triage, and next-action resolution. No agent directly writes `state.json` — all state mutations flow through the pipeline script. The Orchestrator (T02) and Tactical Planner (T03) agents have already been rewritten. The Reviewer agent still contains outdated language saying "only the Tactical Planner" writes `state.json`/`STATUS.md`, and still references the `review-code` skill (which is being renamed to `review-task` to better reflect its scope — it reviews completed tasks, not just raw code).

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/agents/reviewer.agent.md` | Replace `review-code` → `review-task`; remove sole-writer/STATUS.md language |
| CREATE | `.github/skills/review-task/SKILL.md` | New location — copy from `review-code/SKILL.md` with updated name/description |
| CREATE | `.github/skills/review-task/templates/CODE-REVIEW.md` | Move template unchanged from `review-code/templates/` |
| DELETE | `.github/skills/review-code/SKILL.md` | Old location — remove after creating new |
| DELETE | `.github/skills/review-code/templates/CODE-REVIEW.md` | Old location — remove after creating new |

## Implementation Steps

1. **Create the `review-task` skill directory**: Create `.github/skills/review-task/` and `.github/skills/review-task/templates/`.

2. **Create `.github/skills/review-task/SKILL.md`**: Copy the content from `.github/skills/review-code/SKILL.md` with these changes:
   - Change frontmatter `name: review-code` → `name: review-task`
   - Change frontmatter `description` to: `'Review completed tasks against the plan, architecture, and design. Use when performing task-level code review, evaluating code quality, checking architectural consistency, validating design adherence, assessing test coverage, security review, or accessibility audit. Produces a structured review with verdicts, checklists, issues found, and recommendations.'`
   - In the heading, change `# Review Code` → `# Review Task`
   - In the opening paragraph, change "Perform a structured code review after a coding task" → "Perform a structured task review after a coding task completes"
   - All other content (workflow steps, verdict rules, key rules, template reference) remains identical
   - The template reference stays as `[CODE-REVIEW.md](./templates/CODE-REVIEW.md)` (the template name itself does not change)

3. **Copy `.github/skills/review-code/templates/CODE-REVIEW.md`** to `.github/skills/review-task/templates/CODE-REVIEW.md` — content unchanged. The template frontmatter and structure remain identical.

4. **Delete the old directory**: Remove `.github/skills/review-code/SKILL.md` and `.github/skills/review-code/templates/CODE-REVIEW.md`, then remove the `.github/skills/review-code/templates/` and `.github/skills/review-code/` directories.

5. **Modify `.github/agents/reviewer.agent.md`** — make these targeted changes:
   - **Line in "What you do NOT do"**: Change `- Write to \`state.json\` or \`STATUS.md\` — only the Tactical Planner does that` to `- Write to \`state.json\` — no agent directly writes \`state.json\`; all state mutations flow through the pipeline script`
   - **Mode 1, step 9**: Change `**Use the \`review-code\` skill**` → `**Use the \`review-task\` skill**`
   - **Skills section**: Change `- **\`review-code\`**: Guides task-level code review and provides template` → `- **\`review-task\`**: Guides task-level review and provides template`

6. **Verify all `review-code` references are gone** from `reviewer.agent.md` — grep to confirm zero occurrences.

7. **Verify all `STATUS.md` references are gone** from `reviewer.agent.md` — grep to confirm zero occurrences.

8. **Verify all "only the Tactical Planner" language is gone** from `reviewer.agent.md` — grep to confirm zero occurrences.

## Contracts & Interfaces

### Reviewer Agent Frontmatter (unchanged — no frontmatter modifications needed)

The Reviewer agent's frontmatter stays as-is. Only the body content changes:

```yaml
---
name: Reviewer
description: "Review code changes and entire phases against planning documents. Use when performing code review, evaluating code quality, checking architectural consistency, validating design adherence, assessing test coverage, reviewing security, performing phase-level integration review, or generating a final project review."
argument-hint: "Provide the project name, review mode (code/phase/final), and relevant file paths."
tools:
  - read
  - search
  - edit
  - execute
  - todo
agents: []
---
```

### Updated `review-task` Skill Frontmatter

```yaml
---
name: review-task
description: 'Review completed tasks against the plan, architecture, and design. Use when performing task-level code review, evaluating code quality, checking architectural consistency, validating design adherence, assessing test coverage, security review, or accessibility audit. Produces a structured review with verdicts, checklists, issues found, and recommendations.'
---
```

### Current Reviewer Agent Lines to Change

**Line to change (in "What you do NOT do" section)**:

Current:
```
- Write to `state.json` or `STATUS.md` — only the Tactical Planner does that
```

New:
```
- Write to `state.json` — no agent directly writes `state.json`; all state mutations flow through the pipeline script
```

**Line to change (in Mode 1, step 9)**:

Current:
```
9. **Use the `review-code` skill** to produce the document
```

New:
```
9. **Use the `review-task` skill** to produce the document
```

**Line to change (in Skills section)**:

Current:
```
- **`review-code`**: Guides task-level code review and provides template
```

New:
```
- **`review-task`**: Guides task-level review and provides template
```

### CODE-REVIEW.md Template (preserve exactly as-is)

```markdown
---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
task: {TASK_NUMBER}
verdict: "approved|changes_requested|rejected"
severity: "none|minor|critical"
author: "reviewer-agent"
created: "{ISO-DATE}"
---

# Code Review: Phase {N}, Task {N} — {TASK-TITLE}

## Verdict: {APPROVED | CHANGES REQUESTED | REJECTED}

## Summary

{2-3 sentences. Overall assessment.}

## Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Architectural consistency | ✅/⚠️/❌ | {Brief note} |
| Design consistency | ✅/⚠️/❌ | {Brief note} |
| Code quality | ✅/⚠️/❌ | {Brief note} |
| Test coverage | ✅/⚠️/❌ | {Brief note} |
| Error handling | ✅/⚠️/❌ | {Brief note} |
| Accessibility | ✅/⚠️/❌ | {Brief note} |
| Security | ✅/⚠️/❌ | {Brief note} |

## Issues Found

| # | File | Line(s) | Severity | Issue | Suggestion |
|---|------|---------|----------|-------|-----------|
| 1 | `{path}` | {lines} | minor/critical | {Issue} | {Fix suggestion} |

## Positive Observations

- {What was done well}

## Recommendations

- {Recommendation for next task or Planner action}
```

## Styles & Design Tokens

*Not applicable — these are Markdown agent definition and skill files, not UI components.*

## Test Requirements

- [ ] `grep -c "review-code" reviewer.agent.md` returns 0
- [ ] `grep -c "review-task" reviewer.agent.md` returns at least 2 (Mode 1 step 9, Skills section)
- [ ] `grep -c "STATUS.md" reviewer.agent.md` returns 0
- [ ] `grep -ci "only the Tactical Planner" reviewer.agent.md` returns 0
- [ ] `.github/skills/review-task/SKILL.md` exists and has `name: review-task` in frontmatter
- [ ] `.github/skills/review-task/templates/CODE-REVIEW.md` exists with identical content to the original template
- [ ] `.github/skills/review-code/` directory does not exist (fully removed)
- [ ] Reviewer agent frontmatter is still valid chatagent format (parses correctly)
- [ ] All existing test suites pass (no regressions from the rename or agent edit)

## Acceptance Criteria

- [ ] `.github/skills/review-task/` directory exists with `SKILL.md` and `templates/CODE-REVIEW.md`
- [ ] `.github/skills/review-code/` directory does not exist (fully deleted)
- [ ] `review-task/SKILL.md` frontmatter has `name: review-task` and updated description
- [ ] `review-task/SKILL.md` heading is `# Review Task`
- [ ] `review-task/templates/CODE-REVIEW.md` content is identical to the original template
- [ ] `reviewer.agent.md` references `review-task` (not `review-code`) in Mode 1 step 9 and Skills section
- [ ] `reviewer.agent.md` has zero occurrences of `review-code`
- [ ] `reviewer.agent.md` has zero occurrences of `STATUS.md`
- [ ] `reviewer.agent.md` has zero occurrences of "only the Tactical Planner" sole-writer language
- [ ] `reviewer.agent.md` "What you do NOT do" section says state mutations flow through the pipeline script
- [ ] Reviewer agent frontmatter is unchanged (same tools, same description, same agents)
- [ ] All existing test suites pass (0 regressions)
- [ ] Build check passes (no syntax errors, all files parse correctly)

## Constraints

- Do NOT modify the Reviewer agent's frontmatter (tools, description, agents stay the same)
- Do NOT change the Reviewer's Mode 1/2/3 workflow logic — only update skill references and sole-writer language
- Do NOT rename the `CODE-REVIEW.md` template itself — only its parent directory changes
- Do NOT modify the template content — copy it exactly as-is to the new location
- Do NOT modify any other agent files — T05 handles the other 6 agents
- Do NOT modify `copilot-instructions.md` or instruction files — T07 handles those
- Do NOT update `state.json` — only the pipeline script does that
- Do NOT modify any test files — T04 only touches the agent definition and skill directory
- PRESERVE all existing Reviewer functionality (3 modes, verdict logic, checklist, quality standards)
