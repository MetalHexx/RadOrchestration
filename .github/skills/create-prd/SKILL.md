---
name: create-prd
description: 'Create a Product Requirements Document (PRD) from research findings. Use when building a PRD, defining product requirements, writing user stories, specifying functional and non-functional requirements, or creating a requirements document for a new feature or project. Produces a structured PRD with problem statement, goals, user stories, requirements, risks, and success metrics.'
---

# Create PRD

Generate a Product Requirements Document from research findings and a brainstorming document. The PRD defines WHAT needs to be built and WHY — never HOW.

## When to Use This Skill

- After research findings are complete and you need to define product requirements
- When the Orchestrator spawns the Product Manager Agent to create a PRD
- When converting raw research into prioritized, structured requirements

## Inputs Required

| Input | Source | Description |
|-------|--------|-------------|
| Research Findings | `RESEARCH-FINDINGS.md` | Codebase analysis, patterns, constraints discovered |
| Brainstorming document *(optional)* | `BRAINSTORMING.md` | Project idea, validated concepts, and scope boundaries.  |

## Workflow

1. **Read inputs**: Load the Research Findings and Brainstorming document (if it exists). If no brainstorming doc exists, derive context from the Research Findings alone
2. **Identify the problem**: Synthesize a clear, concise problem statement (2-4 sentences)
3. **Define goals and non-goals**: Goals must be measurable outcomes; non-goals prevent scope creep
4. **Write user stories**: Standard format (As a... I want to... So that...) with P0/P1/P2 priority
5. **Define functional requirements**: Numbered (FR-1, FR-2...) for cross-referencing by downstream agents
6. **Define non-functional requirements**: Cover performance, accessibility, security, reliability at minimum
7. **Assess risks and assumptions**: Document known risks with impact and mitigation
8. **Define success metrics**: Measurable targets with clear measurement methods
9. **Write the PRD**: Use the bundled template at [templates/PRD.md](./templates/PRD.md)
10. **Save**: Write to `{PROJECT-DIR}/{NAME}-PRD.md`

## Key Rules

- **No implementation details**: Zero code, zero file paths, zero technology choices — that is the Architect's job
- **Requirements are numbered**: FR-1, FR-2, NFR-1, NFR-2 — downstream agents cross-reference these
- **Priority is explicit**: P0 (must have), P1 (should have), P2 (nice to have)
- **Problem statement is concise**: Max 4 sentences — if you can't state it concisely, it's not well understood

## Template

Use the bundled template: [PRD.md](./templates/PRD.md)
