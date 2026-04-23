# Corrections Workflow — Planner Subagent

Use this workflow when the orchestrator dispatches you with an
`issues_found` audit report from `rad-plan-audit` in hand. You are the
only role with Edit rights to the Requirements doc and the Master Plan.
The auditor reports; you correct.

We only perform a single pass, no reviewer tiers, no retry budget loop. Each finding gets
one judgment: `action` or `decline`. Then you edit, then you summarize.

## Inputs

| Input | Source |
|-------|--------|
| Audit report | Path the orchestrator hands you — look for `verdict: issues_found` in the frontmatter |
| Requirements doc | `{PROJECT-DIR}/{NAME}-REQUIREMENTS.md` |
| Master Plan | `{PROJECT-DIR}/{NAME}-MASTER-PLAN.md` |
| Codebase | Workspace (Grep/Glob/Read) — ground truth for Part 1 findings |

## Per-Finding Disposition

For each row in the audit report's findings table, decide one of:

| Disposition | Default bias |
|-------------|--------------|
| `action` | **Yes — this is the default.** Apply the fix. |
| `decline` | Only when the finding is factually wrong (reviewer misread the source) or genuinely out of scope for this planning set. |

### Action when

- The finding cites a real defect in the Requirements doc or Master
  Plan.
- The ground-truth citation (source file, structural rule, or
  conflicting quote) matches what you verify independently.
- A bounded edit to one or both planning docs resolves the finding.

### Decline when

- Reading the cited `File:Line` shows the finding misread the doc.
- The finding references a rule or requirement that doesn't apply to
  the two-doc scope (e.g., a check that belongs to `code-review`
  post-execution, not `rad-plan-audit`).
- The finding duplicates another finding you've already actioned as
  part of a single edit.

When in doubt, action. The cost of a false-positive decline (unfixed
defect propagated to the coder) is higher than the cost of a
conservative edit.

## Apply the Edits

Walk the finding list and apply every `action` disposition:

- **Requirements doc edits** — add/correct an FR / NFR / AD / DD block,
  fix a tag, correct a path, align terminology. Preserve frontmatter
  and `requirement_count` if you add or remove blocks.
- **Master Plan edits** — add a missing tag, delete a phantom tag,
  correct a mis-cited ID, fix a heading shape, replace a placeholder
  with concrete content, repair a file path, reshape a `code` task to
  the 4-step RED-GREEN form. Preserve frontmatter and update
  `total_phases` / `total_tasks` if you add or remove phases/tasks.
- Keep the edit **bounded to the finding**. Do not refactor adjacent
  prose, do not re-order sections, do not rewrite unrelated tasks.

If applying one finding's fix reveals a further defect the auditor
missed, fix it and note it in the summary. Do not defer.

## Report Back

Return a short summary to the orchestrator as your final output. No
separate addendum file — the summary is the artifact. Include:

- **Per-finding disposition**: one line per finding — `F-N: action` or
  `F-N: decline` — with a one-sentence reason (what you edited, or why
  you declined).
- **Incidentals** (if any): a short list of defects you discovered and
  fixed that were not in the audit report.
- **Touched files**: the doc paths you edited.

Example:

```
Corrections applied.

Finding dispositions:
- F-1: action — added missing `(FR-3)` tag to P01-T02 step 3.
- F-2: action — removed phantom `(FR-99)` citation from P02-T01.
- F-3: decline — reviewer misread; `Modify:` path already correct at
  master plan line 214.

Incidentals:
- Noticed P02-T04 was missing its `**Files:**` block; added it.

Touched files:
- {NAME}-MASTER-PLAN.md
```

The orchestrator consumes this summary, re-invokes the explosion script
to regenerate `phases/` and `tasks/` from the corrected Master Plan, and
proceeds. Your responsibility ends when the summary is returned.
