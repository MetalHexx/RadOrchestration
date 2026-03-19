---
project: "{PROJECT-NAME}"
status: "draft|approved"
total_phases: {Number}
author: "architect-agent"
created: "{ISO-DATE}"
---

# {PROJECT-NAME} — Master Plan

## Executive Summary

{3-5 sentences. What we're building, why, and the high-level approach. A new reader should understand the project after this paragraph.}

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [{NAME}-BRAINSTORMING.md]({path}) | ✅ |
| Research | [{NAME}-RESEARCH-FINDINGS.md]({path}) | ✅ |
| PRD | [{NAME}-PRD.md]({path}) | ✅ |
| Design | [{NAME}-DESIGN.md]({path}) | ✅ |
| Architecture | [{NAME}-ARCHITECTURE.md]({path}) | ✅ |

## Key Requirements (from PRD)

{Curated list of the P0 requirements — NOT a copy of the PRD, just the critical ones that drive phasing.}

- **FR-1**: {Requirement summary}
- **FR-2**: {Requirement summary}
- **NFR-1**: {Requirement summary}

## Key Technical Decisions (from Architecture)

{Curated list of the architectural decisions that constrain implementation.}

- {Decision 1}: {Brief rationale}
- {Decision 2}: {Brief rationale}

## Key Design Constraints (from Design)

{Curated list of design decisions that affect implementation.}

- {Constraint 1}
- {Constraint 2}

## Phase Outline

### Phase 1: {Title}

**Goal**: {One sentence — what this phase achieves}

**Scope**:
- {Deliverable 1} — refs: [FR-1]({prd-path}#fr-1), [auth module]({arch-path}#auth)
- {Deliverable 2} — refs: [Design: LoginForm]({design-path}#loginform)

**Exit Criteria**:
- [ ] {Criterion 1}
- [ ] {Criterion 2}

**Phase Doc**: [phases/{NAME}-PHASE-01-{TITLE}.md]({path}) *(created at execution time)*

---

### Phase 2: {Title}

**Goal**: {One sentence}

**Scope**:
- {Deliverable 1}

**Exit Criteria**:
- [ ] {Criterion 1}

**Phase Doc**: [phases/{NAME}-PHASE-02-{TITLE}.md]({path}) *(created at execution time)*

---

## Execution Constraints

- **Max phases**: {N} (from orchestration.yml)
- **Max tasks per phase**: {N}
- **Git strategy**: Single feature branch, sequential commits
- **Human gates**: {Configured mode or "ask at start"}

## Risk Register

| Risk | Impact | Mitigation | Owner |
|------|--------|-----------|-------|
| {Risk from PRD} | High | {Strategy} | {Agent/Human} |
