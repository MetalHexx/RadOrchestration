---
# The applyTo glob below must match the base_path configured in orchestration.yml.
# If you change base_path, update this pattern to match (or use the configure-system prompt).
applyTo: '.github/projects/**'
---

# Orchestration Project Document Conventions

When creating or editing project documents (path configured in `orchestration.yml` → `projects.base_path`):

## Naming Rules

- Project file names use `SCREAMING-CASE` with the project name prefix: `{NAME}-PRD.md`, `{NAME}-DESIGN.md`
- Phase plans: `{NAME}-PHASE-{NN}-{TITLE}.md` (e.g., `MYAPP-PHASE-01-CORE-API.md`)
- Task handoffs: `{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md` (e.g., `MYAPP-TASK-P01-T03-AUTH.md`)
- Task reports: `{NAME}-TASK-REPORT-P{NN}-T{NN}.md`
- Phase reports: `{NAME}-PHASE-REPORT-P{NN}.md`
- Code reviews: `CODE-REVIEW-P{NN}-T{NN}.md`

## File Ownership (Sole Writer Policy)

Every document has exactly ONE agent that may write it. No other agent may create or modify it.

| Document | Sole Writer |
|----------|-------------|
| `state.json` | Orchestrator via Pipeline Script (`pipeline.js`) |
| `BRAINSTORMING.md` | Brainstormer |
| `RESEARCH-FINDINGS.md` | Research Agent |
| `PRD.md` | Product Manager |
| `DESIGN.md` | UX Designer |
| `ARCHITECTURE.md` | Architect |
| `MASTER-PLAN.md` | Architect |
| `PHASE-PLAN.md` | Tactical Planner |
| `TASK-HANDOFF.md` | Tactical Planner |
| `TASK-REPORT.md` | Coder |
| `CODE-REVIEW.md` | Reviewer |
| `PHASE-REPORT.md` | Tactical Planner |
| `PHASE-REVIEW.md` | Reviewer |
| `ERROR-LOG.md` | Orchestrator (via `log-error` skill) |

## Document Quality Standards

- Use the skill template for each document type — do not invent custom formats
- All requirements must be numbered (FR-1, NFR-1) for cross-referencing
- All interfaces must use language-specific syntax, never pseudocode
- Task handoffs must be self-contained: inline contracts and design tokens, never reference external docs
- Phase exit criteria must be binary (met / not met)
