---
project: "ORCHESTRATION-REORG"
phase: 4
task: 5
title: "Update README.md"
status: "pending"
skills_required: ["file-editing"]
skills_optional: []
estimated_files: 1
---

# Update README.md

## Objective

Update `README.md` with three targeted changes: add a new "Monitoring Dashboard" section with screenshot and link, update Quick Start to reflect single-directory distribution, and add a dashboard row to the documentation table.

## Context

Phase 4 updates all user-facing documentation to reflect the post-reorg repository structure. T01–T04 have already updated `docs/scripts.md`, `docs/project-structure.md`, `docs/getting-started.md`, `docs/validation.md`, and created `docs/dashboard.md`. This task updates the README — the primary landing page visitors see on GitHub. The file `docs/dashboard.md` already exists (created in T04) so the link target is valid.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `README.md` | Three targeted edits: new section, Quick Start update, documentation table row |

## Current README Structure

The current `README.md` has this section order (use these headings to locate insertion points):

```
# Rad Orchestration System
  (intro paragraphs)
## What It Does
  (pipeline mermaid diagram)
## Key Features
  ### Specialized Agents
  ### Document-Driven Architecture
  ### Human Gates
  ### Deterministic Routing & Triage
  ### Composable Skills
  ### Configurable Pipeline
  ### Continuous Verification
  ### Built-in Validation
## Getting Started
  ### Prerequisites
  ### Quick Start
## Documentation
  (table)
## Design Principles
## Platform Support
## License
```

## Implementation Steps

1. **Insert "Monitoring Dashboard" section AFTER the `## What It Does` section and BEFORE `## Key Features`.**

   Find the end of the mermaid diagram block (the closing ` ``` ` after the flowchart). Insert the following section between that closing fence and the `## Key Features` heading:

   ```markdown
   ## Monitoring Dashboard

   The system includes a real-time monitoring dashboard — a Next.js web application
   that visualizes project state, pipeline progress, documents, and configuration.

   ![Monitoring Dashboard](assets/dashboard-screenshot.png)

   Track active projects, drill into phase and task execution, read rendered planning
   documents, and view configuration — all updated in real time via server-sent events.

   [Learn more about the dashboard →](docs/dashboard.md)
   ```

   The exact insertion point is between these two existing blocks:

   **BEFORE (end of What It Does section):**
   ```
       PHASEREVIEW --> FINAL[Final Review]
       FINAL --> GATE2(["✋ Human Approval"])
       GATE2 --> DONE([✅ Complete])
   ```

   **AFTER (start of Key Features):**
   ```
   ## Key Features
   ```

2. **Update Quick Start step 2** — change the copy instruction from multi-directory to single-directory.

   Find this exact line in the `### Quick Start` section:
   ```
   2. Copy the `.github/` and `src/` directories into the root of your target project
   ```

   Replace it with:
   ```
   2. Copy the `.github/` directory into the root of your target project
   ```

3. **Add dashboard row to the Documentation table.**

   Find the documentation table under `## Documentation`. The last row is currently:
   ```
   | [Validation](docs/validation.md) | The `validate-orchestration` CLI tool |
   ```

   Insert a new row immediately after it:
   ```
   | [Monitoring Dashboard](docs/dashboard.md) | Dashboard startup, features, data sources, real-time updates |
   ```

## Contracts & Interfaces

N/A — documentation-only task. No code contracts.

## Styles & Design Tokens

N/A — documentation-only task. No design tokens.

## Test Requirements

- [ ] Verify `## Monitoring Dashboard` heading exists in `README.md`
- [ ] Verify the screenshot image reference `![Monitoring Dashboard](assets/dashboard-screenshot.png)` is present
- [ ] Verify the link `[Learn more about the dashboard →](docs/dashboard.md)` is present
- [ ] Verify Quick Start step 2 reads "Copy the `.github/` directory" (no `src/` mention)
- [ ] Verify the documentation table contains a row with `[Monitoring Dashboard](docs/dashboard.md)`
- [ ] Verify `README.md` renders correctly in Markdown preview (no broken formatting)

## Acceptance Criteria

- [ ] `README.md` contains `## Monitoring Dashboard` section placed after the pipeline diagram and before `## Key Features`
- [ ] Dashboard section includes screenshot image reference and link to `docs/dashboard.md`
- [ ] Quick Start step 2 references single-directory copy (`.github/` only — no mention of `src/`)
- [ ] Documentation table includes "Monitoring Dashboard" row with link to `docs/dashboard.md`
- [ ] Section ordering is preserved: What It Does → Monitoring Dashboard → Key Features → Getting Started → Documentation → Design Principles → Platform Support → License
- [ ] All existing content outside the three targeted changes is unchanged
- [ ] File renders correctly in Markdown preview

## Constraints

- Do NOT modify any sections other than the three specified changes
- Do NOT rewrite or reformat existing content — targeted edits only
- Do NOT change the pipeline Mermaid diagram
- Do NOT modify the Design Principles, Platform Support, or License sections
- Do NOT add any references to external planning documents (PRD, Design, Architecture)
- The screenshot image `assets/dashboard-screenshot.png` does not exist yet (Phase 5 deliverable) — this is expected; use the path as specified
