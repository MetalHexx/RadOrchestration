---
project: "SKILL-RECOMMENDATION"
phase: 1
task: 3
title: "Create Flows-Only and Not-Required Design Templates"
status: "pending"
skills: []  # Skill folder names from .github/skills/ — NOT technology or framework names
estimated_files: 2
---

# Create Flows-Only and Not-Required Design Templates

## Objective

Create two new design document templates — `DESIGN-FLOWS-ONLY.md` and `DESIGN-NOT-REQUIRED.md` — in `.github/skills/create-design/templates/` alongside the existing `DESIGN.md` template. These templates provide lightweight alternatives for projects that have non-visual user-facing flows (flows-only) or no user interaction at all (not-required stub).

## Context

The `create-design` skill currently has a single template (`DESIGN.md`) for full visual UI projects. Two additional templates are needed so the UX Designer can produce appropriate output for non-UI projects instead of fabricating content. The flows-only template retains Design Overview, Triage Decision, and User Flows sections while omitting all visual UI sections. The not-required stub contains frontmatter with `status: "not-required"`, a triage decision, and a statement confirming no design is needed. Both templates use placeholder syntax consistent with the existing `DESIGN.md` template (e.g., `{PROJECT-NAME}`, `{ISO-DATE}`).

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/skills/create-design/templates/DESIGN-FLOWS-ONLY.md` | Flows-only template — for projects with non-visual user-facing flows |
| CREATE | `.github/skills/create-design/templates/DESIGN-NOT-REQUIRED.md` | Not-required stub template — for projects with no user interaction |

## Implementation Steps

1. **Create `DESIGN-FLOWS-ONLY.md`** at `.github/skills/create-design/templates/DESIGN-FLOWS-ONLY.md` with the exact content specified in the Contracts section below
2. **Create `DESIGN-NOT-REQUIRED.md`** at `.github/skills/create-design/templates/DESIGN-NOT-REQUIRED.md` with the exact content specified in the Contracts section below
3. **Verify the existing `DESIGN.md` template is unchanged** — confirm that `.github/skills/create-design/templates/DESIGN.md` has not been modified
4. **Verify both new files are valid markdown** — frontmatter has correct YAML syntax, all section headings use proper markdown heading levels, placeholder syntax uses `{PLACEHOLDER}` format

## Contracts & Interfaces

### DESIGN-FLOWS-ONLY.md — Exact Content

The file `.github/skills/create-design/templates/DESIGN-FLOWS-ONLY.md` must contain exactly:

````markdown
---
project: "{PROJECT-NAME}"
status: "draft|review|approved"
author: "ux-designer-agent"
created: "{ISO-DATE}"
---

# {PROJECT-NAME} — Design

## Design Overview

{2-3 sentences. What user-facing flows exist and what interaction model do they use? Why is a full design document not needed?}

## Triage Decision

| Criterion | Assessment |
|-----------|------------|
| Has visual UI? | No |
| Has non-visual user-facing flows? | Yes |
| Project scope | {Brief description} |
| **Route** | **Flows only** |

## User Flows

### {Flow Name}

{Diagram}:
{Step 1} → {Step 2} → {Step 3} → {Outcome}

{Brief description of the flow, inputs, outputs, and decision points.}

## Sections Omitted

The following standard Design sections are intentionally omitted because this project has no visual UI:

- **Layout & Components** — No views, pages, or UI components
- **Design Tokens** — No visual styling
- **States & Interactions** — No visual state changes
- **Accessibility** — No visual interface to make accessible (flow accessibility is addressed in User Flows above)
- **Responsive Behavior** — No rendered output
- **Design System Additions** — Nothing to add
````

### DESIGN-NOT-REQUIRED.md — Exact Content

The file `.github/skills/create-design/templates/DESIGN-NOT-REQUIRED.md` must contain exactly:

````markdown
---
project: "{PROJECT-NAME}"
status: "not-required"
author: "ux-designer-agent"
created: "{ISO-DATE}"
---

# {PROJECT-NAME} — Design

## Design Overview

**Design document not required.** {One sentence explaining why — e.g., "This project modifies backend API endpoints with no user-facing interface changes."}

## Triage Decision

| Criterion | Assessment |
|-----------|------------|
| Has visual UI? | No |
| Has non-visual user-facing flows? | No |
| Project scope | {Brief description} |
| **Route** | **Not required — stub** |

## Sections Omitted

The following standard Design sections are intentionally omitted because they do not apply:

- **User Flows** — No user-facing flows
- **Layout & Components** — No views, pages, or UI components
- **Design Tokens** — No visual styling
- **States & Interactions** — No interactive elements
- **Accessibility** — No user interface to make accessible
- **Responsive Behavior** — No rendered output
- **Design System Additions** — Nothing to add

## No Design Decisions Needed

All changes in this project are {brief characterization — e.g., "structural edits to API contracts"}. The Architect and Tactical Planner should treat this document as confirmation that no design constraints apply.
````

## Styles & Design Tokens

Not applicable — these are markdown template files with no visual output.

## Test Requirements

- [ ] `.github/skills/create-design/templates/DESIGN-FLOWS-ONLY.md` exists and is a valid markdown file with YAML frontmatter
- [ ] `.github/skills/create-design/templates/DESIGN-NOT-REQUIRED.md` exists and is a valid markdown file with YAML frontmatter
- [ ] `DESIGN-FLOWS-ONLY.md` frontmatter contains fields: `project`, `status`, `author`, `created`
- [ ] `DESIGN-FLOWS-ONLY.md` `status` field value is `"draft|review|approved"` (placeholder for runtime selection)
- [ ] `DESIGN-NOT-REQUIRED.md` frontmatter `status` field value is `"not-required"` (fixed value, not a placeholder)
- [ ] `DESIGN-FLOWS-ONLY.md` contains sections: Design Overview, Triage Decision, User Flows, Sections Omitted
- [ ] `DESIGN-FLOWS-ONLY.md` does NOT contain sections: Layout & Components, Design Tokens, States & Interactions, Accessibility, Responsive Behavior, Design System Additions (as headings)
- [ ] `DESIGN-NOT-REQUIRED.md` contains sections: Design Overview, Triage Decision, Sections Omitted, No Design Decisions Needed
- [ ] `DESIGN-NOT-REQUIRED.md` does NOT contain a User Flows section (as a heading)
- [ ] The existing `DESIGN.md` template is unchanged

## Acceptance Criteria

- [ ] `.github/skills/create-design/templates/DESIGN-FLOWS-ONLY.md` exists with content matching the Contracts section above
- [ ] `.github/skills/create-design/templates/DESIGN-NOT-REQUIRED.md` exists with content matching the Contracts section above
- [ ] `DESIGN-FLOWS-ONLY.md` frontmatter has `author: "ux-designer-agent"` and placeholder fields `{PROJECT-NAME}` and `{ISO-DATE}`
- [ ] `DESIGN-NOT-REQUIRED.md` frontmatter has `status: "not-required"` (fixed value, not a placeholder)
- [ ] `DESIGN-FLOWS-ONLY.md` Triage Decision table shows Route as "Flows only"
- [ ] `DESIGN-NOT-REQUIRED.md` Triage Decision table shows Route as "Not required — stub"
- [ ] `DESIGN-FLOWS-ONLY.md` Sections Omitted lists all 6 omitted sections (Layout & Components, Design Tokens, States & Interactions, Accessibility, Responsive Behavior, Design System Additions)
- [ ] `DESIGN-NOT-REQUIRED.md` Sections Omitted lists all 7 omitted sections (User Flows, Layout & Components, Design Tokens, States & Interactions, Accessibility, Responsive Behavior, Design System Additions)
- [ ] `DESIGN-NOT-REQUIRED.md` contains a "No Design Decisions Needed" section
- [ ] The existing `.github/skills/create-design/templates/DESIGN.md` is not modified
- [ ] No other files are created or modified

## Constraints

- Do NOT modify the existing `DESIGN.md` template at `.github/skills/create-design/templates/DESIGN.md`
- Do NOT modify any files outside `.github/skills/create-design/templates/`
- Do NOT add any content beyond what is specified in the Contracts section — the templates must match the specification exactly
- Do NOT change placeholder syntax — use `{PLACEHOLDER}` format consistent with the existing template
