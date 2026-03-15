---
project: "SKILL-RECOMMENDATION"
phase: 1
task: 4
title: "Add Triage Logic to create-design Skill"
status: "pending"
skills: ["validate-orchestration"]  # Skill folder names from .github/skills/ — NOT technology or framework names
estimated_files: 1
---

# Add Triage Logic to create-design Skill

## Objective

Add a triage step to the `create-design/SKILL.md` skill workflow that evaluates the PRD before producing any Design content, routing to one of three output paths: full Design document (visual UI), flows-only document (non-visual user-facing flows), or "not required" stub (no user interaction). Update the Key Rules, Template, and description sections to reflect the three output paths.

## Context

The `create-design` skill currently always produces a full Design document regardless of project type. Two new templates were created in the previous task: `DESIGN-FLOWS-ONLY.md` (for non-visual user-facing flows) and `DESIGN-NOT-REQUIRED.md` (for projects with no user interaction). Both templates already exist at `.github/skills/create-design/templates/`. This task adds triage logic to the skill's workflow so the UX Designer routes to the correct template based on PRD content analysis. The triage text must be written so it is exactly reusable in the UX Designer agent file (a later task adds identical triage criteria there).

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/skills/create-design/SKILL.md` | Add triage step, update Key Rules, update Template section, update description |

## Implementation Steps

1. **Open** `.github/skills/create-design/SKILL.md`

2. **Update the frontmatter `description`** to mention the triage behavior. Change the description to:

   ```yaml
   description: 'Create a UX Design document from a Product Requirements Document (PRD). Triages the PRD to route to one of three output paths: full Design (visual UI), flows-only (non-visual user-facing flows), or not-required stub (no user interaction). Use when designing user interfaces, user flows, component layouts, interaction states, accessibility requirements, responsive behavior, or specifying design tokens and design system usage. Produces a structured design doc, flows-only doc, or not-required stub based on project type.'
   ```

3. **Update the introductory paragraph** (the text between `# Create Design` and `## When to Use This Skill`) to mention the triage:

   ```markdown
   Generate a UX Design document from the PRD. Before producing any content, triage the PRD to determine the project's interaction model — then route to the appropriate template and workflow. For full-design projects, the Design defines the visual and interaction design — component structure, user flows, states, design tokens, and accessibility.
   ```

4. **Insert the triage step as step 2 in the Workflow section**, immediately after the existing step 1 ("Read inputs"). Use this exact text:

   ```markdown
   2. **Triage project type**: Evaluate the PRD's user stories and functional requirements to classify the project:
      - **Full Design** — Has a visual UI (frontend, views, components). Continue with steps 3–12 using the full template at [templates/DESIGN.md](./templates/DESIGN.md).
      - **Flows only** — Has user-facing flows but no visual UI (CLI wizard, interactive terminal). Use the flows-only template at [templates/DESIGN-FLOWS-ONLY.md](./templates/DESIGN-FLOWS-ONLY.md). Write only Design Overview and User Flows, then save.
      - **Not required** — No user interaction (backend, scripts, instruction files). Use the stub template at [templates/DESIGN-NOT-REQUIRED.md](./templates/DESIGN-NOT-REQUIRED.md). Record the decision and rationale, then save.

      Default to "Not required" when uncertain.
   ```

5. **Renumber all subsequent workflow steps**: The current steps 2–11 become steps 3–12. Verify all step numbers are sequential after insertion.

6. **Update the Key Rules section** by adding the following three bullet points at the beginning of the existing list:

   ```markdown
   - **Triage before writing**: Always evaluate the PRD before producing any content — never skip the triage step
   - **Three output paths**: Full Design (visual UI), Flows only (non-visual user-facing flows), Not required (no user interaction) — each uses its own template
   - **Default to "Not required"**: When the project classification is uncertain, produce the not-required stub — this is safer than fabricating design content for a non-UI project
   ```

7. **Replace the Template section** (the `## Template` section at the bottom of the file) with:

   ```markdown
   ## Templates

   | Output Path | Template | When to Use |
   |-------------|----------|-------------|
   | Full Design | [DESIGN.md](./templates/DESIGN.md) | Project has a visual UI (frontend, views, components) |
   | Flows only | [DESIGN-FLOWS-ONLY.md](./templates/DESIGN-FLOWS-ONLY.md) | Project has non-visual user-facing flows (CLI wizard, interactive terminal) |
   | Not required | [DESIGN-NOT-REQUIRED.md](./templates/DESIGN-NOT-REQUIRED.md) | Project has no user interaction (backend, scripts, instruction files) |
   ```

8. **Verify the final file** has the complete workflow numbered 1–12, with triage at step 2, and that all three templates are referenced with correct relative paths.

## Contracts & Interfaces

This task modifies a markdown instruction file. The contract is the exact content that must appear in the file.

### Triage Step — Exact Text (Step 2)

This is the exact text for the new workflow step 2. It must appear verbatim:

```markdown
2. **Triage project type**: Evaluate the PRD's user stories and functional requirements to classify the project:
   - **Full Design** — Has a visual UI (frontend, views, components). Continue with steps 3–12 using the full template at [templates/DESIGN.md](./templates/DESIGN.md).
   - **Flows only** — Has user-facing flows but no visual UI (CLI wizard, interactive terminal). Use the flows-only template at [templates/DESIGN-FLOWS-ONLY.md](./templates/DESIGN-FLOWS-ONLY.md). Write only Design Overview and User Flows, then save.
   - **Not required** — No user interaction (backend, scripts, instruction files). Use the stub template at [templates/DESIGN-NOT-REQUIRED.md](./templates/DESIGN-NOT-REQUIRED.md). Record the decision and rationale, then save.

   Default to "Not required" when uncertain.
```

**CRITICAL**: This triage text is reused in a subsequent task (T05) that adds identical routing logic to the UX Designer agent. The criteria, output path names, template references, examples, and default-when-uncertain rule must be preserved exactly so both files produce identical routing for the same PRD input.

### New Key Rules — Exact Text (prepend to existing list)

```markdown
- **Triage before writing**: Always evaluate the PRD before producing any content — never skip the triage step
- **Three output paths**: Full Design (visual UI), Flows only (non-visual user-facing flows), Not required (no user interaction) — each uses its own template
- **Default to "Not required"**: When the project classification is uncertain, produce the not-required stub — this is safer than fabricating design content for a non-UI project
```

### Template Section — Exact Replacement

The existing `## Template` section (singular) with the single link to `DESIGN.md` must be replaced entirely by:

```markdown
## Templates

| Output Path | Template | When to Use |
|-------------|----------|-------------|
| Full Design | [DESIGN.md](./templates/DESIGN.md) | Project has a visual UI (frontend, views, components) |
| Flows only | [DESIGN-FLOWS-ONLY.md](./templates/DESIGN-FLOWS-ONLY.md) | Project has non-visual user-facing flows (CLI wizard, interactive terminal) |
| Not required | [DESIGN-NOT-REQUIRED.md](./templates/DESIGN-NOT-REQUIRED.md) | Project has no user interaction (backend, scripts, instruction files) |
```

### Workflow Step Renumbering — Expected Result

After inserting the triage step, the workflow should be:

| Step | Content |
|------|---------|
| 1 | Read inputs (unchanged) |
| 2 | **Triage project type** (NEW) |
| 3 | Design overview (was 2) |
| 4 | Map user flows (was 3) |
| 5 | Define layouts (was 4) |
| 6 | Define new components (was 5) |
| 7 | Document design tokens (was 6) |
| 8 | Specify states & interactions (was 7) |
| 9 | Define accessibility (was 8) |
| 10 | Specify responsive behavior (was 9) |
| 11 | Write the Design doc (was 10) |
| 12 | Save (was 11) |

## Styles & Design Tokens

Not applicable — this task modifies a markdown instruction file, not a UI component.

## Test Requirements

- [ ] The file `.github/skills/create-design/SKILL.md` parses as valid markdown with correct YAML frontmatter
- [ ] The Workflow section contains exactly 12 numbered steps
- [ ] Step 1 is "Read inputs" (unchanged)
- [ ] Step 2 is "Triage project type" with three sub-bullets (Full Design, Flows only, Not required) and the default-when-uncertain rule
- [ ] Steps 3–12 are the original steps 2–11, renumbered correctly
- [ ] The triage step text matches the Contracts section verbatim — including output path names, template relative paths, examples, and the default rule
- [ ] The Key Rules section contains the three new rules (triage before writing, three output paths, default to not required) PLUS all original rules
- [ ] The Templates section (now plural) lists all three templates in a table with correct relative paths
- [ ] The template links use relative paths: `./templates/DESIGN.md`, `./templates/DESIGN-FLOWS-ONLY.md`, `./templates/DESIGN-NOT-REQUIRED.md`
- [ ] The frontmatter `description` mentions triage behavior and three output paths

## Acceptance Criteria

- [ ] Step 2 of the Workflow is the triage step with exact text matching the Contracts section
- [ ] The triage step lists three output paths: Full Design, Flows only, Not required
- [ ] The triage step specifies "Default to 'Not required' when uncertain"
- [ ] The triage step references all three templates with correct relative paths
- [ ] The Workflow contains exactly 12 steps, numbered sequentially 1–12
- [ ] Original workflow steps (read inputs, design overview, map user flows, etc.) are preserved and renumbered correctly
- [ ] The Key Rules section includes triage-related rules in addition to all original rules
- [ ] The Template section is renamed to "Templates" and lists all three templates in a table
- [ ] The frontmatter description mentions triage and three output paths
- [ ] The introductory paragraph mentions triage
- [ ] No other files are created or modified
- [ ] The existing templates (DESIGN.md, DESIGN-FLOWS-ONLY.md, DESIGN-NOT-REQUIRED.md) are not modified

## Constraints

- Do NOT modify any template files (`DESIGN.md`, `DESIGN-FLOWS-ONLY.md`, `DESIGN-NOT-REQUIRED.md`) — they are already complete
- Do NOT modify any other skill or agent files — only `.github/skills/create-design/SKILL.md`
- Do NOT change the existing workflow steps' content — only renumber them
- Do NOT add new workflow steps beyond the triage step
- Do NOT remove any existing Key Rules — only prepend the three new ones
- The triage step text must be preserved exactly as specified — it will be reused in the UX Designer agent file in a subsequent task, and consistency between the two files is a project-level requirement
