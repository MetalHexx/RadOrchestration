---
project: "SKILL-RECOMMENDATION"
phase: 1
task: 5
title: "Add Triage Step to UX Designer Agent"
status: "pending"
skills: ["validate-orchestration"]  # Skill folder names from .github/skills/ — NOT technology or framework names
estimated_files: 1
---

# Add Triage Step to UX Designer Agent

## Objective

Add a triage step to the UX Designer agent definition (`.github/agents/ux-designer.agent.md`) that evaluates the PRD before producing any Design content, routing to one of three output paths: full Design (visual UI), flows-only (non-visual user-facing flows), or not-required stub (no user interaction). The triage must use routing criteria functionally identical to those already present in `.github/skills/create-design/SKILL.md` step 2, ensuring both entry points produce the same routing for any given PRD.

## Context

The `create-design/SKILL.md` already contains a triage step (step 2) that routes to three output paths. The UX Designer agent definition currently has no triage — it always proceeds through the full design workflow. This task adds a matching triage step to the agent so that both the agent definition and the skill instruction produce identical routing decisions. The agent triage uses adapted wording (different step numbering, agent-context phrasing) but the same routing criteria, output path names, template references, and default-when-uncertain rule.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/agents/ux-designer.agent.md` | Insert triage step, renumber workflow steps, no other changes |

## Implementation Steps

1. **Open** `.github/agents/ux-designer.agent.md`
2. **Locate** the Workflow section — the current numbered steps are 1–12
3. **Insert the triage step as new step 3** after step 2 ("Read the Research Findings") and before the current step 3 ("Design overview"). Use the exact text specified in the Contracts section below
4. **Renumber** current steps 3–12 to become steps 4–13. The full mapping is:
   - Step 1 "Read the PRD" → stays step 1 (unchanged)
   - Step 2 "Read the Research Findings" → stays step 2 (unchanged)
   - **NEW step 3** "Triage project type" → inserted here
   - Step 3 "Design overview" → becomes step 4
   - Step 4 "Map user flows" → becomes step 5
   - Step 5 "Define layouts" → becomes step 6
   - Step 6 "Define new components" → becomes step 7
   - Step 7 "Document design tokens" → becomes step 8
   - Step 8 "Specify states & interactions" → becomes step 9
   - Step 9 "Define accessibility" → becomes step 10
   - Step 10 "Specify responsive behavior" → becomes step 11
   - Step 11 "Use the `create-design` skill" → becomes step 12
   - Step 12 "Save" → becomes step 13
5. **Verify** the triage step references steps 4–13 for the Full Design path (matching the renumbered steps)
6. **Verify** template path references use backtick-wrapped paths: `` `templates/DESIGN-FLOWS-ONLY.md` `` and `` `templates/DESIGN-NOT-REQUIRED.md` ``
7. **Verify** the default-when-uncertain rule reads: `Default to "Not required" when the classification is uncertain.`
8. **Verify** the final workflow has exactly 13 steps numbered sequentially 1–13
9. **Do not modify** any other section of the file — frontmatter, Role & Constraints, Skills, Output Contract, and Quality Standards remain unchanged

## Contracts & Interfaces

### Triage Step — Exact Text to Insert as Step 3

```markdown
3. **Triage project type**: Evaluate the PRD's user stories and functional requirements to determine the project's interaction model. Route to one of three output paths:
   - **Full Design** — The project has a visual UI (frontend views, components, pages). Proceed with steps 4–13 using the full template.
   - **Flows only** — The project has user-facing flows but no visual UI (CLI wizard, interactive terminal, multi-step process). Use the flows-only template at `templates/DESIGN-FLOWS-ONLY.md`. Write only the Design Overview and User Flows sections, then save and stop.
   - **Not required** — The project has no user interaction (backend service, pipeline script, data processor, instruction file changes). Use the stub template at `templates/DESIGN-NOT-REQUIRED.md`. Record the triage decision and rationale, then save and stop.

   Default to "Not required" when the classification is uncertain.
```

### Consistency Reference — `create-design/SKILL.md` Step 2 (DO NOT COPY — for verification only)

The skill file already contains this triage step (step 2):

```markdown
2. **Triage project type**: Evaluate the PRD's user stories and functional requirements to classify the project:
   - **Full Design** — Has a visual UI (frontend, views, components). Continue with steps 3–12 using the full template at [templates/DESIGN.md](./templates/DESIGN.md).
   - **Flows only** — Has user-facing flows but no visual UI (CLI wizard, interactive terminal). Use the flows-only template at [templates/DESIGN-FLOWS-ONLY.md](./templates/DESIGN-FLOWS-ONLY.md). Write only Design Overview and User Flows, then save.
   - **Not required** — No user interaction (backend, scripts, instruction files). Use the stub template at [templates/DESIGN-NOT-REQUIRED.md](./templates/DESIGN-NOT-REQUIRED.md). Record the decision and rationale, then save.

   Default to "Not required" when uncertain.
```

The agent version uses adapted wording (step numbers 4–13, fuller descriptions, backtick paths instead of link syntax) but the routing criteria are functionally identical:

| Criterion | Skill (step 2) | Agent (step 3) | Match? |
|-----------|----------------|-----------------|--------|
| Full Design trigger | "Has a visual UI (frontend, views, components)" | "The project has a visual UI (frontend views, components, pages)" | ✅ Identical routing |
| Flows-only trigger | "Has user-facing flows but no visual UI (CLI wizard, interactive terminal)" | "The project has user-facing flows but no visual UI (CLI wizard, interactive terminal, multi-step process)" | ✅ Identical routing |
| Not-required trigger | "No user interaction (backend, scripts, instruction files)" | "The project has no user interaction (backend service, pipeline script, data processor, instruction file changes)" | ✅ Identical routing |
| Default | "Not required" when uncertain | "Not required" when uncertain | ✅ Identical |
| Template refs | Relative links (./templates/...) | Backtick paths (templates/...) | ✅ Format-adapted |

## Styles & Design Tokens

Not applicable — this task modifies a markdown agent definition file with no visual output.

## Test Requirements

- [ ] YAML frontmatter is valid and unchanged from the original file
- [ ] Workflow section contains exactly 13 numbered steps (1–13)
- [ ] Step 1 is "Read the PRD" (unchanged)
- [ ] Step 2 is "Read the Research Findings" (unchanged)
- [ ] Step 3 is "Triage project type" with three sub-bullets (Full Design, Flows only, Not required) and default rule
- [ ] Steps 4–13 are the original steps 3–12 renumbered correctly (Design overview, Map user flows, Define layouts, Define new components, Document design tokens, Specify states & interactions, Define accessibility, Specify responsive behavior, Use the create-design skill, Save)
- [ ] The Full Design bullet references "steps 4–13"
- [ ] Template paths reference `templates/DESIGN-FLOWS-ONLY.md` and `templates/DESIGN-NOT-REQUIRED.md`
- [ ] Default rule states: Default to "Not required" when the classification is uncertain
- [ ] Triage routing criteria are functionally identical to `create-design/SKILL.md` step 2 (same three output paths, same classification triggers, same default)
- [ ] No sections outside the Workflow were modified (frontmatter, Role & Constraints, Skills, Output Contract, Quality Standards all unchanged)

## Acceptance Criteria

- [ ] Step 3 of the Workflow is the triage step with text matching the Contracts section above
- [ ] The triage step lists three output paths: Full Design, Flows only, Not required
- [ ] The triage step specifies "Default to 'Not required' when the classification is uncertain"
- [ ] The triage step references both template paths (`templates/DESIGN-FLOWS-ONLY.md` and `templates/DESIGN-NOT-REQUIRED.md`)
- [ ] The Full Design path references "steps 4–13"
- [ ] The Workflow contains exactly 13 steps, numbered sequentially 1–13
- [ ] Original workflow steps (Read the PRD, Read the Research Findings, Design overview, Map user flows, etc.) are preserved and renumbered correctly
- [ ] No other sections of the file are modified (frontmatter, Role & Constraints, Skills, Output Contract, Quality Standards)
- [ ] No other files are created or modified
- [ ] The triage routing criteria produce identical routing decisions as `create-design/SKILL.md` step 2 for the same PRD input (verified by inspecting the consistency reference table in Contracts above)

## Constraints

- Do NOT modify any section outside the Workflow (frontmatter, Role & Constraints, Skills, Output Contract, Quality Standards must remain unchanged)
- Do NOT copy the skill file's triage text verbatim — use the agent-specific text from the Contracts section which has adapted wording and step numbers
- Do NOT add new sections, new skills references, or new output contract entries
- Do NOT modify any other files — this task touches exactly one file
- Do NOT change the `create-design/SKILL.md` file — it was completed in T04 and is locked
