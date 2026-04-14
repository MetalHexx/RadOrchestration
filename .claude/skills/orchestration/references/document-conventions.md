# Document Conventions

Canonical reference for all pipeline-produced document naming, placement, and frontmatter values.

Covers all documents produced during pipeline execution. Planning documents (PRD, Design, Architecture, Master Plan, Research Findings, Brainstorming) and execution documents (Phase Plan, Task Handoff, Code Review, Phase Report, Phase Review).

## Filename Patterns & Placement

| Document Type | Subdirectory | Filename Pattern | Example |
|---|---|---|---|
| Brainstorming | — (root) | `{NAME}-BRAINSTORMING.md` | `MYAPP-BRAINSTORMING.md` |
| Research Findings | — (root) | `{NAME}-RESEARCH-FINDINGS.md` | `MYAPP-RESEARCH-FINDINGS.md` |
| PRD | — (root) | `{NAME}-PRD.md` | `MYAPP-PRD.md` |
| Design | — (root) | `{NAME}-DESIGN.md` | `MYAPP-DESIGN.md` |
| Architecture | — (root) | `{NAME}-ARCHITECTURE.md` | `MYAPP-ARCHITECTURE.md` |
| Master Plan | — (root) | `{NAME}-MASTER-PLAN.md` | `MYAPP-MASTER-PLAN.md` |
| Error Log | — (root) | `{NAME}-ERROR-LOG.md` | `MYAPP-ERROR-LOG.md` |
| Phase Plan | phases/ | `{NAME}-PHASE-{NN}-{TITLE}.md` | `MYAPP-PHASE-01-SETUP.md` |
| Task Handoff | tasks/ | `{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md` | `MYAPP-TASK-P01-T02-AUTH.md` |
| Code Review | reports/ | `{NAME}-CODE-REVIEW-P{NN}-T{NN}-{TITLE}.md` | `MYAPP-CODE-REVIEW-P01-T02-AUTH.md` |
| Phase Report | reports/ | `{NAME}-PHASE-REPORT-P{NN}-{TITLE}.md` | `MYAPP-PHASE-REPORT-P01-SETUP.md` |
| Phase Review | reports/ | `{NAME}-PHASE-REVIEW-P{NN}-{TITLE}.md` | `MYAPP-PHASE-REVIEW-P01-SETUP.md` |

## Frontmatter Field Reference

| Field | Type | Valid Values | Used In |
|---|---|---|---|
| project | string | Project name in SCREAMING-CASE (e.g., `"MYAPP"`) | All templates |
| phase | integer | Phase number, 1-based (e.g., `1`) | All templates |
| task | integer | Task number, 1-based (e.g., `2`) | Task Handoff, Code Review |
| title | string | Human-readable title (e.g., `"Setup Auth"`) | Task Handoff, Phase Plan, Phase Report |
| status | string | Varies by document — see below | Task Handoff, Phase Plan, Phase Report |
| skills | array | Skill folder names from `.claude/skills/` | Task Handoff |
| estimated_files | integer | Estimated file count (e.g., `3`) | Task Handoff |
| tasks | array | List of `{id, title}` objects | Phase Plan |
| author | string | Agent name (e.g., `"tactical-planner-agent"`) | Phase Plan, Phase Report, Phase Review, Code Review |
| created | string | ISO 8601 date-time (e.g., `"2026-01-15T00:00:00.000Z"`) | Phase Plan, Phase Report, Phase Review, Code Review |
| verdict | string | `"approved"` \| `"changes_requested"` \| `"rejected"` | Code Review, Phase Review |
| severity | string | `"none"` \| `"minor"` \| `"critical"` | Code Review, Phase Review |
| exit_criteria_met | boolean | `true` \| `false` | Phase Review |
| tasks_completed | integer | Number of completed tasks (e.g., `3`) | Phase Report |
| tasks_total | integer | Total tasks in phase (e.g., `4`) | Phase Report |

**`status` field values by document type:**

- Task Handoff: `"pending"`
- Phase Plan: `"active"` | `"complete"` | `"halted"`
- Phase Report: `"complete"` | `"partial"` | `"failed"`

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
