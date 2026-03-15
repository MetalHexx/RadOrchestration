---
project: "SKILL-RECOMMENDATION"
phase: 1
title: "Instruction and Template Changes"
status: "active"
total_tasks: 6
tasks:
  - id: "T01-HANDOFF-TEMPLATE"
    title: "Consolidate Skills Field in Task Handoff Template"
  - id: "T02-SKILL-DISCOVERY"
    title: "Add Skill Discovery Step to create-task-handoff Skill"
  - id: "T03-DESIGN-TEMPLATES"
    title: "Create Flows-Only and Not-Required Design Templates"
  - id: "T04-DESIGN-SKILL-TRIAGE"
    title: "Add Triage Logic to create-design Skill"
  - id: "T05-AGENT-TRIAGE"
    title: "Add Triage Step to UX Designer Agent"
  - id: "T06-DOCUMENTATION"
    title: "Add Skill Discovery and Design Triage Documentation"
author: "tactical-planner-agent"
created: "2026-03-15T00:00:00Z"
---

# Phase 1: Instruction and Template Changes

## Phase Goal

Implement all skill discovery, template consolidation, design triage, and documentation changes across the two independent workstreams (task handoff skill discovery + UX Designer triage) plus documentation updates, modifying 6 existing markdown files and creating 2 new template files.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../SKILL-RECOMMENDATION-MASTER-PLAN.md) | Phase 1 scope (all 6 change areas), exit criteria, execution constraints (max 8 tasks) |
| [Architecture](../SKILL-RECOMMENDATION-ARCHITECTURE.md) | Module map, all contracts (template shape, discovery step, triage step, templates, docs), file structure, dependency order, consistency constraint |
| [PRD](../SKILL-RECOMMENDATION-PRD.md) | FR-1 through FR-10, NFR-1 through NFR-5, user stories, success metrics |
| [Design](../SKILL-RECOMMENDATION-DESIGN.md) | Not-required stub — no design constraints apply |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | Consolidate Skills Field in Task Handoff Template | — | — | 1 | [Link](../tasks/SKILL-RECOMMENDATION-TASK-P01-T01-HANDOFF-TEMPLATE.md) |
| T02 | Add Skill Discovery Step to create-task-handoff Skill | T01 | — | 1 | [Link](../tasks/SKILL-RECOMMENDATION-TASK-P01-T02-SKILL-DISCOVERY.md) |
| T03 | Create Flows-Only and Not-Required Design Templates | — | — | 2 | [Link](../tasks/SKILL-RECOMMENDATION-TASK-P01-T03-DESIGN-TEMPLATES.md) |
| T04 | Add Triage Logic to create-design Skill | T03 | — | 1 | [Link](../tasks/SKILL-RECOMMENDATION-TASK-P01-T04-DESIGN-SKILL-TRIAGE.md) |
| T05 | Add Triage Step to UX Designer Agent | T04 | — | 1 | [Link](../tasks/SKILL-RECOMMENDATION-TASK-P01-T05-AGENT-TRIAGE.md) |
| T06 | Add Skill Discovery and Design Triage Documentation | T02, T05 | — | 2 | [Link](../tasks/SKILL-RECOMMENDATION-TASK-P01-T06-DOCUMENTATION.md) |

## Execution Order

```
T01 (handoff template)     T03 (design templates)
 │                          │
 ▼                          ▼
T02 (skill discovery)      T04 (design skill triage)
 │                          │
 │                          ▼
 │                         T05 (agent triage)
 │                          │
 └──────────┬───────────────┘
            ▼
           T06 (documentation)
```

**Sequential execution order**: T01 → T02 → T03 → T04 → T05 → T06

*Note: T01 and T03 are parallel-ready (no mutual dependency). T02 and T04 are parallel-ready given their respective predecessors are complete. Both workstreams converge at T06.*

## Phase Exit Criteria

- [ ] Task handoff template has single `skills` field with inline YAML comment; `skills_required` and `skills_optional` fields are removed
- [ ] `create-task-handoff/SKILL.md` workflow includes skill discovery step with enumeration and evaluation instructions
- [ ] `DESIGN-FLOWS-ONLY.md` template exists with Design Overview, Triage Decision, User Flows, and Sections Omitted
- [ ] `DESIGN-NOT-REQUIRED.md` template exists with frontmatter (`status: "not-required"`), Design Overview, Triage Decision, Sections Omitted, and No Design Decisions Needed
- [ ] `create-design/SKILL.md` includes triage logic routing to three output paths with template references
- [ ] `ux-designer.agent.md` includes triage step with identical routing criteria and default-when-uncertain rule
- [ ] Triage logic in agent and skill produces identical routing for the same PRD input
- [ ] `docs/skills.md` contains note explaining Tactical Planner skill discovery during handoff creation
- [ ] `docs/agents.md` contains note explaining UX Designer triage behavior
- [ ] All changes are markdown files only — no scripts, config, or pipeline engine changes
- [ ] Existing full `DESIGN.md` template is unchanged
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed

## Known Risks for This Phase

- **Agent-skill triage drift**: Triage logic in `ux-designer.agent.md` (T05) and `create-design/SKILL.md` (T04) must use identical criteria, output paths, template references, and default behavior. The T05 handoff must inline the exact triage text from the Architecture to ensure consistency. Reviewer should verify both files match.
- **Discovery step ignored**: The Tactical Planner may revert to technology labels despite the new skill discovery step. The inline YAML comment in the template (T01) and the explicit numbered step in the skill (T02) work together as complementary safeguards.
- **Stub DESIGN.md breaks downstream**: The not-required stub must include valid frontmatter with `status: "not-required"` so downstream agents handle it correctly. T03 must match the Architecture's template specification exactly.
