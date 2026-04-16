---
project: "{PROJECT-NAME}"
status: "draft"
total_phases: {N}
author: "tactical-planner-agent"
created: "{YYYY-MM-DD}"
---

# {PROJECT-NAME} — Master Plan

## Executive Summary

{3–5 sentences. Describe what is being built and why it matters. Summarize the high-level approach — the key phases or milestones that organize execution. State who the primary users are and what outcome successful delivery produces. A new reader should understand the project, its purpose, and its structure after reading this paragraph.}

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [{NAME}-BRAINSTORMING.md](./{NAME}-BRAINSTORMING.md) | ✅ Complete |
| Research Findings | [{NAME}-RESEARCH-FINDINGS.md](./{NAME}-RESEARCH-FINDINGS.md) | ✅ Complete |
| PRD | [{NAME}-PRD.md](./{NAME}-PRD.md) | ✅ Complete |
| Design | [{NAME}-DESIGN.md](./{NAME}-DESIGN.md) | ✅ Complete |
| Architecture | [{NAME}-ARCHITECTURE.md](./{NAME}-ARCHITECTURE.md) | ✅ Complete |

## Phase Outlines

### Phase N: {Title}

**Objective**: {One sentence — what this phase achieves and why it matters}

**Scope**:
- FR-N, FR-M — [§ FR-N: {Title}]({prd-path}#fr-n), [§ FR-M: {Title}]({prd-path}#fr-m)
- NFR-N — [§ NFR-N: {Title}]({prd-path}#nfr-n)
- AD-N, AD-M — [§ AD-N: {Title}]({arch-path}#ad-n), [§ AD-M: {Title}]({arch-path}#ad-m)
- DD-N, DD-M — [§ DD-N: {Title}]({design-path}#dd-n), [§ DD-M: {Title}]({design-path}#dd-m)
- Research: {Finding Heading} — [§ {Heading}]({research-path}#{anchor})

**Exit Criteria**:
- [ ] {Measurable outcome — the criterion is met or it is not}
- [ ] {Measurable outcome}

**Phase Doc**: *(created at execution time)*

## Execution Constraints

- **Max phases**: {N} (from `state.json → config.limits.max_phases`)
- **Max tasks per phase**: {N} (from `state.json → config.limits.max_tasks_per_phase`)
- **Git strategy**: {Single feature branch or as configured}
- **Human gates**: {Configured gate mode from state.json → config.gate_mode}

## Risk Register

| Risk | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| {Risk aggregated from PRD or Architecture} | High/Medium/Low | {Mitigation strategy} | {Agent name or Human} |
