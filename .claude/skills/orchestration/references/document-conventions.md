# Document Conventions

Canonical reference for all pipeline-produced document naming, placement, and frontmatter values.

Covers all documents produced during pipeline execution. Planning documents (Master Plan, Requirements, Brainstorming) and execution documents (Phase Plan, Task Handoff, Code Review, Phase Report, Phase Review).

## Filename Patterns & Placement

| Document Type | Subdirectory | Filename Pattern | Example |
|---|---|---|---|
| Brainstorming | — (root) | `{NAME}-BRAINSTORMING.md` | `MYAPP-BRAINSTORMING.md` |
| Master Plan | — (root) | `{NAME}-MASTER-PLAN.md` | `MYAPP-MASTER-PLAN.md` |
| Requirements | — (root) | `{NAME}-REQUIREMENTS.md` | `MYAPP-REQUIREMENTS.md` |
| Error Log | — (root) | `{NAME}-ERROR-LOG.md` | `MYAPP-ERROR-LOG.md` |
| Phase Plan | phases/ | `{NAME}-PHASE-{NN}-{TITLE}.md` | `MYAPP-PHASE-01-SETUP.md` |
| Task Handoff | tasks/ | `{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md` | `MYAPP-TASK-P01-T02-AUTH.md` |
| Code Review | reports/ | `{NAME}-CODE-REVIEW-P{NN}-T{NN}-{TITLE}.md` | `MYAPP-CODE-REVIEW-P01-T02-AUTH.md` |
| Phase Report | reports/ | `{NAME}-PHASE-REPORT-P{NN}-{TITLE}.md` | `MYAPP-PHASE-REPORT-P01-SETUP.md` |
| Phase Review | reports/ | `{NAME}-PHASE-REVIEW-P{NN}-{TITLE}.md` | `MYAPP-PHASE-REVIEW-P01-SETUP.md` |

### Corrective Filename Suffix

When a producing skill re-authors a document during a corrective cycle, append the suffix `-C{corrective_index}` immediately before `.md`. Read `corrective_index` from the event context — do not query the filesystem. The original (non-corrective) document is preserved, not overwritten.

- Normal (first-time): `{NAME}-PHASE-{NN}-{TITLE}.md`
- Corrective: `{NAME}-PHASE-{NN}-{TITLE}-C{corrective_index}.md`

| Scenario | Filename |
|----------|----------|
| Original plan | `MYPROJ-PHASE-02-SETUP.md` |
| First correction | `MYPROJ-PHASE-02-SETUP-C1.md` |
| Second correction | `MYPROJ-PHASE-02-SETUP-C2.md` |

The same `-C{N}` suffix rule applies to Code Reviews, Phase Reviews, and Phase Reports. Each producing skill's workflow cross-references this section for the shared pattern.

## Frontmatter Field Reference

| Field | Type | Valid Values | Used In |
|---|---|---|---|
| project | string | Project name in SCREAMING-CASE (e.g., `"MYAPP"`) | All templates |
| type | string | `"requirements"` \| `"master_plan"` (additional document-type marker on new docs) | Requirements, Master Plan |
| phase | integer | Phase number, 1-based (e.g., `1`) | Phase Plan, Task Handoff, Code Review, Phase Report, Phase Review |
| task | integer | Task number, 1-based (e.g., `2`) | Task Handoff, Code Review |
| title | string | Human-readable title (e.g., `"Setup Auth"`) | Task Handoff, Phase Plan, Phase Report |
| status | string | Varies by document — see below | Task Handoff, Phase Plan, Phase Report, Requirements, Master Plan |
| skills | array | Skill folder names from `.claude/skills/` | Task Handoff |
| estimated_files | integer | Estimated file count (e.g., `3`) | Task Handoff |
| tasks | array | List of `{id, title}` objects | Phase Plan |
| author | string | Agent or script name (e.g., `"planner-agent"`, `"explosion-script"`) | Phase Plan, Phase Report, Phase Review, Code Review, Requirements, Master Plan |
| created | string | ISO 8601 date-time (e.g., `"2026-01-15T00:00:00.000Z"`) or ISO 8601 date (e.g., `"2026-01-15"`) | Phase Plan, Phase Report, Phase Review, Code Review, Requirements, Master Plan |
| approved_at | string \| null | ISO 8601 date-time or `null` until a human gate approves the doc | Requirements |
| requirement_count | integer | Total FR + NFR + AD + DD blocks in the doc body (e.g., `12`) | Requirements |
| total_phases | integer | Count of `## PNN:` phase headings in the Master Plan body | Master Plan |
| total_tasks | integer | Count of `### PNN-TMM:` task headings in the Master Plan body | Master Plan |
| verdict | string | `"approved"` \| `"changes_requested"` \| `"rejected"` | Code Review, Phase Review |
| severity | string | `"none"` \| `"minor"` \| `"critical"` | Code Review, Phase Review |
| exit_criteria_met | boolean | `true` \| `false` | Phase Review |
| tasks_completed | integer | Number of completed tasks (e.g., `3`) | Phase Report |
| tasks_total | integer | Total tasks in phase (e.g., `4`) | Phase Report |

**`status` field values by document type:**

- Task Handoff: `"pending"`
- Phase Plan: `"active"` | `"complete"` | `"halted"`
- Phase Report: `"complete"` | `"partial"` | `"failed"`
- Requirements: `"draft"` | `"approved"` | `"frozen"`
- Master Plan: `"draft"` | `"approved"`

## Placeholder Token Convention

- All multi-word placeholders use `{SCREAMING-KEBAB-CASE}` (e.g., `{PHASE-NUMBER}`, `{TASK-NUMBER}`, `{TASK-TITLE}`, `{PROJECT-NAME}`)
- Single-word placeholders use `{SCREAMING-CASE}` (e.g., `{NAME}`, `{TITLE}`, `{NUMBER}`)
- Zero-padded numbers use `{NN}` only inside filename patterns (shorthand for a two-digit number); in frontmatter fields, use the explicit name (e.g., `{PHASE-NUMBER}`)
- The `{TASK-ID}` compound token (e.g., `T01-AUTH`) is a named exception — it is a composite of task number and title slug, not a general placeholder
- `{ISO-DATE}` means ISO 8601 date-time string (e.g., `2026-03-22T00:00:00.000Z`)

## Maintenance Note

Changes to filename patterns in this file must be propagated to three other locations to maintain consistency:

1. **Action routing tables** in `orchestrator.agent.md` and `pipeline-guide.md`
2. **Individual SKILL.md save paths** in each producing skill's output contract
3. **`docs/project-structure.md`** project folder tree and naming conventions table
