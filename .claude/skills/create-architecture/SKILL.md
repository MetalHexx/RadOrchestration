---
name: create-architecture
description: 'Create a technical Architecture document from a PRD and Design document. Use when defining system architecture, module structure, API contracts, interfaces, dependencies, file structure, cross-cutting concerns, or phasing recommendations. Produces a structured architecture doc with system layers, module map, contracts, API endpoints, and dependency graphs.'
---

# Create Architecture

Generate a technical Architecture document from the PRD and Design. The Architecture defines HOW the system will be built — modules, contracts, dependencies, file structure. High-level enough to guide multiple agents, specific enough to define contracts.

## When to Use This Skill

- After both the PRD and Design are complete and you need to define the technical approach
- When the Orchestrator spawns the Architect Agent to create an Architecture document
- When defining module boundaries, interfaces/contracts, and file structure

## Inputs Required

| Input | Source | Description |
|-------|--------|-------------|
| PRD | `{NAME}-PRD.md` | Functional/non-functional requirements |
| Design | `{NAME}-DESIGN.md` | Per-component layouts and interaction states (heading-per-item), optional design tokens and accessibility (if included) |
| Research Findings | `RESEARCH-FINDINGS.md` | Per-finding codebase evidence organized by area, technology stack, constraints |

## Workflow

1. **Read inputs**: Load the PRD, Design, and Research Findings
2. **Technical overview**: Summarize the high-level approach and technology choices (2-4 sentences)
3. **Define system layers**: Map the layers (Presentation, Application, Domain, Infrastructure)
4. **Create module map**: Every module with its layer, path, and responsibility — no orphan code
5. **Define contracts & interfaces**: The EXACT interfaces that agents must conform to — language-specific syntax required
6. **Specify API endpoints**: Method, path, request/response types, auth requirements
7. **Document dependencies**: External packages and internal module-to-module dependencies
8. **Define file structure**: Concrete paths — exact locations, not vague references
9. **Address cross-cutting concerns**: Error handling, logging, authentication, state management
10. **Recommend phasing**: Advisory phasing suggestions for the Tactical Planner
11. **Write the Architecture doc**: Use the bundled template at [templates/ARCHITECTURE.md](./templates/ARCHITECTURE.md)
12. **Save**: Write to `{PROJECT-DIR}/{NAME}-ARCHITECTURE.md`

## Key Rules

- **Contracts are critical**: These are the EXACT interfaces parallel agents must conform to. TypeScript/language-specific syntax required
- **Concrete file paths**: Exact locations — not "somewhere in src/"
- **No implementation logic**: Interfaces yes, method bodies no. `login(): Promise<AuthToken>` yes, the actual HTTP call no
- **Phasing is advisory**: The Tactical Planner makes final phasing decisions

## Template

Use the bundled template: [ARCHITECTURE.md](./templates/ARCHITECTURE.md)
