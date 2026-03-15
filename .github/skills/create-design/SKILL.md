---
name: create-design
description: 'Create a UX Design document from a Product Requirements Document (PRD). Use when designing user interfaces, user flows, component layouts, interaction states, accessibility requirements, responsive behavior, or specifying design tokens and design system.
---

# Create Design

Generate a UX Design document from the PRD. Before producing any content, triage the PRD to determine the project's interaction model — then route to the appropriate template and workflow. For full-design projects, the Design defines the visual and interaction design — component structure, user flows, states, design tokens, and accessibility.

## When to Use This Skill

- After the PRD is complete and you need to define the user experience
- When the Orchestrator spawns the UX Designer Agent to create a Design document
- When specifying component layouts, interaction states, and responsive behavior

## Inputs Required

| Input | Source | Description |
|-------|--------|-------------|
| PRD | `{NAME}-PRD.md` | Product requirements, user stories, functional requirements |
| Research Findings | `RESEARCH-FINDINGS.md` | Existing patterns, technology stack, codebase analysis |

## Workflow

1. **Read inputs**: Load the PRD and Research Findings
2. **Triage project type**: Evaluate the PRD's user stories and functional requirements to classify the project:
   - **Full Design** — Has a visual UI (frontend, views, components). Continue with steps 3–12 using the full template at [templates/DESIGN.md](./templates/DESIGN.md).
   - **Flows only** — Has user-facing flows but no visual UI (CLI wizard, interactive terminal). Use the flows-only template at [templates/DESIGN-FLOWS-ONLY.md](./templates/DESIGN-FLOWS-ONLY.md). Write only Design Overview and User Flows, then save.
   - **Not required** — No user interaction (backend, scripts, instruction files). Use the stub template at [templates/DESIGN-NOT-REQUIRED.md](./templates/DESIGN-NOT-REQUIRED.md). Record the decision and rationale, then save.

   Default to "Not required" when uncertain.
3. **Design overview**: Summarize the user experience being designed (2-3 sentences)
4. **Map user flows**: Create step-by-step flows for each key user story
5. **Define layouts**: Specify view/page layouts with regions, components, and breakpoints
6. **Define new components**: Full props, design tokens, and descriptions for any new components
7. **Document design tokens**: Reference actual tokens from the design system
8. **Specify states & interactions**: Every component state with visual treatment
9. **Define accessibility**: Keyboard navigation, screen reader support, color contrast, focus indicators
10. **Specify responsive behavior**: Layout changes per breakpoint
11. **Write the Design doc**: Use the bundled template at [templates/DESIGN.md](./templates/DESIGN.md)
12. **Save**: Write to `{PROJECT-DIR}/{NAME}-DESIGN.md`

## Key Rules

- **Triage before writing**: Always evaluate the PRD before producing any content — never skip the triage step
- **Three output paths**: Full Design (visual UI), Flows only (non-visual user-facing flows), Not required (no user interaction) — each uses its own template
- **Default to "Not required"**: When the project classification is uncertain, produce the not-required stub — this is safer than fabricating design content for a non-UI project
- **Design tokens must be real**: Reference actual tokens from the design system; list new ones in Design System Additions
- **New components need full props**: Component name, props, design tokens, description — feeds into Architecture
- **Accessibility is mandatory**: WCAG AA minimum; every interactive element must be addressed
- **No code**: Component names and props only — implementation lives in tasks

## Templates

| Output Path | Template | When to Use |
|-------------|----------|-------------|
| Full Design | [DESIGN.md](./templates/DESIGN.md) | Project has a visual UI (frontend, views, components) |
| Flows only | [DESIGN-FLOWS-ONLY.md](./templates/DESIGN-FLOWS-ONLY.md) | Project has non-visual user-facing flows (CLI wizard, interactive terminal) |
| Not required | [DESIGN-NOT-REQUIRED.md](./templates/DESIGN-NOT-REQUIRED.md) | Project has no user interaction (backend, scripts, instruction files) |
