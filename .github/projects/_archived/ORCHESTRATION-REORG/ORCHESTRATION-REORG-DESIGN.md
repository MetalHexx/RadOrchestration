---
project: "ORCHESTRATION-REORG"
status: "draft"
author: "ux-designer-agent"
created: "2026-03-10T00:00:00Z"
---

# ORCHESTRATION-REORG — Design

## Design Overview

The "user interface" of this project is the repository itself — its folder hierarchy, README, and documentation pages. The design defines how a developer browsing the repo perceives structure, discovers features, and understands what to copy. Every design decision optimizes for a 30-second comprehension target: a new visitor should be able to determine the purpose of every root-level directory, find the dashboard, and understand the adoption path within a single scroll of the README.

## User Flows

### Flow 1: New Adopter — First Visit Discovery

```
Land on repo root → Read README title & tagline →
  See pipeline diagram → See dashboard screenshot →
  Read "Key Features" → Find Quick Start →
  Understand "copy .github/ into your project" →
  See documentation table (with dashboard link) → Done
```

The new adopter's first impression is formed by the README above the fold. The dashboard screenshot is the first visual proof that the system produces a tangible monitoring experience. The single-directory adoption message replaces the current two-directory instruction.

### Flow 2: New Adopter — Dashboard Discovery

```
See screenshot in README → Click "Learn more about the dashboard" link →
  Land on docs/dashboard.md → Read purpose & prerequisites →
  Follow startup instructions → Open localhost:3000 →
  See live project data → Explore sidebar/dashboard/documents
```

The dashboard is currently invisible. This flow ensures it surfaces within the first scroll of the README and links directly to a dedicated docs page with startup instructions.

### Flow 3: Contributor — Understanding Active vs. Historical

```
Browse repo root → See .github/ (active system), ui/ (dashboard), docs/ (documentation), archive/ (historical) →
  Infer from folder names: ".github = system, archive = old stuff" →
  Open archive/ only if researching design history →
  Never accidentally modify archived files
```

The `archive/` folder name is deliberately chosen over alternatives (`plan/`, `historical/`, `legacy/`) because it is the most universally understood signal for "preserved but not active." Contributors intuitively skip it when looking for files to modify.

### Flow 4: Contributor — Finding Scripts and Tests

```
Browse .github/ → See orchestration/ subfolder →
  Open orchestration/ → See scripts/, schemas/ →
  Open scripts/ → See CLI entry points + lib/ + tests/ →
  Understand: scripts and tests live together, inside the distributable tree
```

The co-location of scripts and tests under `.github/orchestration/scripts/` matches the mental model of "everything needed to run the system lives in one tree." Test discovery requires zero navigation outside the distributable directory.

### Flow 5: Pipeline Operator — Running Scripts Post-Reorg

```
Read agent instructions or docs/scripts.md →
  See updated CLI path: node .github/orchestration/scripts/next-action.js →
  Run command → Get JSON output → Continue pipeline
```

All script invocation paths in agent files, instruction files, skill files, and documentation reflect the new `.github/orchestration/scripts/` location. The operator never encounters a stale `src/` reference.

### Flow 6: Documentation Reader — Finding Dashboard Docs

```
Open README → Scroll to Documentation table →
  See "Monitoring Dashboard" row with link to docs/dashboard.md →
  Click link → Read structured page →
  Sections: Purpose, Prerequisites, Startup, Features, Data Sources, Real-Time Updates
```

The documentation table gains one new row. The page follows the same structural conventions as existing docs pages (title, intro paragraph, sections with headers, code blocks for commands).

## Layout & Components

### Root Directory Layout (Post-Reorg)

The root directory is the top-level "page" of the repository. Each entry must have an immediately obvious purpose.

| Position | Entry | Purpose Signal | Notes |
|----------|-------|---------------|-------|
| 1 | `.github/` | Active orchestration system | Contains agents, skills, scripts, config, projects — the single distributable directory |
| 2 | `archive/` | Historical design artifacts | Name signals "preserved, not active" — replaces `plan/` |
| 3 | `assets/` | Static assets (images) | Dashboard screenshot for README; standard convention |
| 4 | `docs/` | Documentation pages | 9 pages (8 existing + 1 new dashboard page) |
| 5 | `ui/` | Monitoring dashboard app | Self-contained Next.js application |
| 6 | `README.md` | Entry point | First thing every visitor reads |
| 7 | `LICENSE` | License file | Standard |

**Removed entries:**
- `src/` — contents moved to `.github/orchestration/scripts/`
- `tests/` — contents moved to `.github/orchestration/scripts/tests/`
- `plan/` — contents moved to `archive/`
- `bin/` — deleted (empty, zero references)

### `.github/orchestration/` Layout

This new directory consolidates runtime scripts and the active schema within the distributable `.github/` tree.

| Entry | Contents | Notes |
|-------|----------|-------|
| `scripts/` | 3 CLI entry points + `lib/` subfolder (4 modules) | Moved from `src/` — internal `lib/` structure preserved |
| `scripts/tests/` | 18 test files | Moved from `tests/` — co-located with scripts |
| `schemas/` | `state-json-schema.md` | The one active schema file promoted from `plan/schemas/` |

```
.github/orchestration/
├── scripts/
│   ├── next-action.js
│   ├── triage.js
│   ├── validate-state.js
│   ├── lib/
│   │   ├── constants.js
│   │   ├── resolver.js
│   │   ├── state-validator.js
│   │   └── triage-engine.js
│   └── tests/
│       ├── agents.test.js
│       ├── config.test.js
│       ├── constants.test.js
│       ├── cross-refs.test.js
│       ├── frontmatter.test.js
│       ├── fs-helpers.test.js
│       ├── instructions.test.js
│       ├── next-action.test.js
│       ├── prompts.test.js
│       ├── reporter.test.js
│       ├── resolver.test.js
│       ├── skills.test.js
│       ├── state-validator.test.js
│       ├── structure.test.js
│       ├── triage-engine.test.js
│       ├── triage.test.js
│       ├── validate-state.test.js
│       └── yaml-parser.test.js
└── schemas/
    └── state-json-schema.md
```

### `archive/` Layout

All historical design artifacts grouped under one clearly-named root directory.

| Entry | Contents | Origin |
|-------|----------|--------|
| `ORCHESTRATION-MASTER-PLAN.md` | Original system design plan | `plan/ORCHESTRATION-MASTER-PLAN.md` |
| `orchestration-human-draft.md` | Original human draft | `plan/orchestration-human-draft.md` |
| `schemas/` | 14 relic template files | `plan/schemas/` (minus the active `state-json-schema.md`) |

```
archive/
├── ORCHESTRATION-MASTER-PLAN.md
├── orchestration-human-draft.md
└── schemas/
    ├── architecture-template.md
    ├── code-review-template.md
    ├── cross-agent-dependency-map.md
    ├── design-template.md
    ├── master-plan-template.md
    ├── orchestration-yml-schema.md
    ├── phase-plan-template.md
    ├── phase-report-template.md
    ├── phase-review-template.md
    ├── prd-template.md
    ├── research-findings-template.md
    ├── status-md-template.md
    ├── task-handoff-template.md
    └── task-report-template.md
```

### `assets/` Layout

Minimal directory for static repository assets.

| Entry | Contents | Notes |
|-------|----------|-------|
| `dashboard-screenshot.png` | Screenshot of the monitoring dashboard | Used by README; captured from running UI at `localhost:3000` |

```
assets/
└── dashboard-screenshot.png
```

### README Layout

The README is the primary "landing page" of the repository. The design specifies section ordering, content blocks, and the placement of new elements.

**Section order (top to bottom):**

| # | Section | Content | New/Existing |
|---|---------|---------|-------------|
| 1 | Title + Tagline | "Rad Orchestration System" + 2-sentence description | Existing (unchanged) |
| 2 | Pipeline Diagram | Mermaid flowchart | Existing (unchanged) |
| 3 | **Monitoring Dashboard** | Screenshot image + 2-sentence description + link to `docs/dashboard.md` | **NEW** |
| 4 | Key Features | 9 feature sections with doc links | Existing (unchanged) |
| 5 | Getting Started | Prerequisites + Quick Start (updated for single-directory) | Existing (**modified**) |
| 6 | Documentation | Table of doc pages (with new dashboard row) | Existing (**modified**) |
| 7 | Design Principles | 7 principles | Existing (unchanged) |
| 8 | Platform Support | Portability note | Existing (unchanged) |
| 9 | License | License link | Existing (unchanged) |

**Section 3 — Monitoring Dashboard (NEW):**

```markdown
## Monitoring Dashboard

The system includes a real-time monitoring dashboard — a Next.js web application
that visualizes project state, pipeline progress, documents, and configuration.

![Monitoring Dashboard](assets/dashboard-screenshot.png)

Track active projects, drill into phase and task execution, read rendered planning
documents, and view configuration — all updated in real time via server-sent events.

[Learn more about the dashboard →](docs/dashboard.md)
```

**Placement rationale:** The dashboard section sits immediately after the pipeline diagram and before Key Features. This is the "above the fold" zone — the first screenful a visitor sees on GitHub. The screenshot provides visual proof of a real, working UI before the visitor reads any feature descriptions.

**Section 5 — Getting Started (MODIFIED):**

The Quick Start step 2 changes from:

> Copy the `.github/` and `src/` directories into the root of your target project

To:

> Copy the `.github/` directory into the root of your target project

This is the single most impactful text change in the reorg — it communicates the new single-directory distribution model.

**Section 6 — Documentation Table (MODIFIED):**

One new row added:

| Page | Description |
|------|-------------|
| [Monitoring Dashboard](docs/dashboard.md) | Dashboard startup, features, data sources, real-time updates |

The new row is inserted after the "Validation" row (last current entry) to maintain alphabetical-ish grouping of system-level docs, with the UI docs at the end.

### `docs/dashboard.md` Page Layout

A new documentation page following the structural conventions of existing docs pages.

**Section order:**

| # | Section | Content |
|---|---------|---------|
| 1 | Title | `# Monitoring Dashboard` |
| 2 | Intro paragraph | 2-3 sentences: what the dashboard is, what it shows, why it exists |
| 3 | Screenshot | Same `assets/dashboard-screenshot.png` image |
| 4 | Prerequisites | Node.js v18+, npm, workspace with orchestration projects |
| 5 | Getting Started | `cd ui && npm install && npm run dev` with `.env.local` setup |
| 6 | Features | Subsections for each major capability |
| 7 | Data Sources | What files the dashboard reads and why |
| 8 | Real-Time Updates | How SSE + chokidar file watching works |
| 9 | Component Architecture | High-level component map (sidebar, dashboard, planning, execution, documents, config) |
| 10 | Next Steps | Links to related docs |

**Section 6 — Features (subsections):**

| Subsection | Content |
|-----------|---------|
| Project Sidebar | Browse all projects, see status at a glance |
| Dashboard Overview | Pipeline progress, phase/task summary, key metrics |
| Planning Pipeline | Visualize planning steps (research → PRD → design → architecture → master plan) |
| Execution Drill-Down | Phase and task execution views with status, retries, verdicts |
| Document Viewer | Rendered markdown for all planning and execution documents |
| Configuration Viewer | Parsed `orchestration.yml` display |
| Status Indicators | Connection status, pipeline tier badges, review verdicts, severity, warnings |
| Theme Support | Light and dark mode |

**Structural conventions followed (matching existing docs pages):**
- Single `#` title
- Intro paragraph (no heading)
- Major sections use `##`
- Subsections use `###`
- Code blocks for shell commands with comments
- Tables for structured reference information
- Links to other docs at the end

### `docs/project-structure.md` Layout (MODIFIED)

The existing project structure page needs its workspace layout tree updated to reflect the new structure.

**Changes to the workspace layout tree:**

| Change | Old | New |
|--------|-----|-----|
| Remove `src/` block | `src/` with 7 files | Removed — scripts now under `.github/orchestration/` |
| Remove `tests/` entry | `tests/` | Removed — tests now under `.github/orchestration/scripts/tests/` |
| Add `orchestration/` under `.github/` | (not present) | `.github/orchestration/` with `scripts/` and `schemas/` |
| Add `archive/` | (not present) | `archive/` with historical design files |
| Add `assets/` | (not present) | `assets/` with dashboard screenshot |
| Remove `bin/` reference | (if present) | Removed |

**Updated workspace layout tree:**

```
.github/
├── agents/                    # 9 agent definitions
│   └── ...
├── skills/                    # 17 skill bundles
│   └── ...
├── instructions/              # Scoped instruction files
│   └── ...
├── prompts/                   # Utility prompt files
│   └── ...
├── orchestration/             # Runtime scripts, tests, and schemas
│   ├── scripts/
│   │   ├── next-action.js     # Next-Action Resolver CLI
│   │   ├── triage.js          # Triage Executor CLI
│   │   ├── validate-state.js  # State Validator CLI
│   │   ├── lib/
│   │   │   ├── constants.js
│   │   │   ├── resolver.js
│   │   │   ├── state-validator.js
│   │   │   └── triage-engine.js
│   │   └── tests/             # All test files (18 total)
│   │       └── ...
│   └── schemas/
│       └── state-json-schema.md
├── orchestration.yml          # System configuration
├── copilot-instructions.md    # Workspace-level instructions
└── projects/                  # Project artifacts
    └── {PROJECT-NAME}/
        └── ...
archive/                       # Historical design artifacts
├── ORCHESTRATION-MASTER-PLAN.md
├── orchestration-human-draft.md
└── schemas/                   # Relic templates (14 files)
    └── ...
assets/                        # Static assets
└── dashboard-screenshot.png
docs/                          # Documentation (9 pages)
├── getting-started.md
├── agents.md
├── pipeline.md
├── skills.md
├── configuration.md
├── project-structure.md
├── scripts.md
├── validation.md
└── dashboard.md               # NEW
ui/                            # Monitoring dashboard (Next.js)
└── ...
```

### `docs/scripts.md` Layout (MODIFIED)

The scripts documentation page is the densest concentration of path references (~20+ references to `src/` and `tests/`). The design specifies the structural changes.

**Architecture diagram update:**

Old:
```
src/
├── lib/
│   ├── constants.js
│   ...
```

New:
```
.github/orchestration/scripts/
├── lib/
│   ├── constants.js
│   ...
```

**CLI usage updates (pattern):**

All CLI invocation examples change from `node src/<script>.js` to `node .github/orchestration/scripts/<script>.js`.

| Old Path | New Path |
|----------|----------|
| `node src/next-action.js` | `node .github/orchestration/scripts/next-action.js` |
| `node src/triage.js` | `node .github/orchestration/scripts/triage.js` |
| `node src/validate-state.js` | `node .github/orchestration/scripts/validate-state.js` |
| `src/lib/constants.js` | `.github/orchestration/scripts/lib/constants.js` |

**Test execution updates:**

Old:
```bash
node tests/constants.test.js
node tests/resolver.test.js
```

New:
```bash
node .github/orchestration/scripts/tests/constants.test.js
node .github/orchestration/scripts/tests/resolver.test.js
```

### `docs/getting-started.md` Layout (MODIFIED)

**Single change:** Installation step 3 text changes from "Copy the `.github/` and `src/` directories" to "Copy the `.github/` directory." The accompanying explanation sentence is updated to omit the `src/` clause.

### `docs/validation.md` Layout (MODIFIED)

**Single change:** The state validation CLI reference updates from `node src/validate-state.js` to `node .github/orchestration/scripts/validate-state.js`.

## Design Tokens Used

This project does not involve visual UI components, CSS, or a traditional design system. The "design tokens" are the **naming conventions and structural patterns** that communicate meaning through the repository layout.

| Token | Value | Usage |
|-------|-------|-------|
| Archive folder name | `archive/` | Universally understood as "preserved, not active" — chosen over `plan/`, `historical/`, `legacy/`, `old/` |
| Assets folder name | `assets/` | Standard GitHub convention for repository static assets |
| Orchestration folder name | `orchestration/` | Descriptive sub-namespace within `.github/` for runtime scripts and schemas |
| Scripts subfolder name | `scripts/` | Matches existing convention (`.github/skills/validate-orchestration/scripts/`) |
| Tests subfolder name | `tests/` | Co-located test directory within `scripts/` — mirrors the original root `tests/` name |
| Schemas subfolder name | `schemas/` | Preserves the name from `plan/schemas/` for the promoted active schema |
| Screenshot filename | `dashboard-screenshot.png` | Descriptive, hyphenated, standard image format for GitHub rendering |
| New docs page name | `dashboard.md` | Follows existing pattern: lowercase, single-word or hyphenated, `.md` extension |

## States & Interactions

Since the "interface" is a static file tree and markdown documents, "states" refer to the intermediate states the repository passes through during the phased reorganization. Each state must be fully functional.

| State | Repository Condition | Functional Status |
|-------|---------------------|-------------------|
| Pre-Reorg (Current) | `src/`, `tests/`, `plan/`, `bin/` at root; no `archive/`, `assets/`, `orchestration/` | Fully functional — baseline |
| Dual-Path Phase | New files created at `.github/orchestration/`; old `src/` and `tests/` still present | Fully functional — both old and new paths exist; agent files may reference either |
| Path Cutover | Agent files, instruction files, skill files, and docs updated to reference new paths | Fully functional — all active references point to new locations; old files still present as safety net |
| Cleanup Complete | `src/`, `tests/`, `plan/`, `bin/` removed; `archive/` and `assets/` created; README and docs updated | Fully functional — final target state |

**Transition rules:**
- No intermediate state may leave the pipeline non-functional (NFR-1)
- Agent file path updates and script moves must be atomic within the same phase — never update a reference to a path that doesn't exist yet
- The validate-orchestration check suite must pass at every intermediate state (FR-18)

## Accessibility

Accessibility for a repository structure means **cognitive accessibility** — how easily developers of varying experience levels can parse, navigate, and understand the layout.

| Requirement | Implementation |
|-------------|---------------|
| Folder name clarity | Every root-level folder uses a plain English name that signals its purpose without requiring documentation (`archive/`, `assets/`, `docs/`, `ui/`) |
| No ambiguous names | No folder names that could mean multiple things — `plan/` (is it active?) replaced with `archive/` (clearly not active) |
| Screenshot alt text | Dashboard screenshot in README uses descriptive alt text: `![Monitoring Dashboard](assets/dashboard-screenshot.png)` |
| Consistent heading hierarchy | All docs pages use `#` for title, `##` for major sections, `###` for subsections — no skipped levels |
| Code block language hints | All code blocks in docs specify language (`bash`, `json`, `jsonc`) for syntax highlighting in both GitHub rendering and local editors |
| Link text describes destination | Every documentation link uses descriptive text ("Learn more about the dashboard →") rather than bare URLs or "click here" |
| README scannability | Key information (dashboard screenshot, single-directory adoption) appears above the fold — within the first ~40 lines or first screenful on GitHub |
| Archive separation | Historical files are physically separated from active files, preventing accidental modification by contributors who may not read documentation |

## Responsive Behavior

"Responsive behavior" for this project refers to how the repository structure and README render across different viewing contexts.

| Context | Behavior |
|---------|----------|
| GitHub.com (desktop) | README renders with full Mermaid diagram, inline screenshot image, and full-width tables. Tree structure in docs renders in monospace. All relative links work. |
| GitHub.com (mobile) | README wraps gracefully. Screenshot scales to viewport width. Tables scroll horizontally. Mermaid diagram may collapse to a simplified view. |
| VS Code Explorer | Folder tree shows `.github/`, `archive/`, `assets/`, `docs/`, `ui/` at root. Collapsing `.github/` hides the full orchestration system. `archive/` sorts near the top alphabetically. |
| VS Code Markdown Preview | README renders with local image paths. Dashboard screenshot displays inline. All relative links resolve within the workspace. |
| Local clone (terminal `ls`) | Root listing shows 5 directories + README + LICENSE. Each directory name is self-explanatory. `archive/` immediately signals "not active." |
| npm/Node.js context | `node .github/orchestration/scripts/next-action.js` works from workspace root. Path is longer than `node src/next-action.js` but is unambiguous about location and avoids confusion with project source code. |

## Design System Additions

### New Documentation Page

| Type | Name | Description | Rationale |
|------|------|-------------|-----------|
| Doc page | `docs/dashboard.md` | Monitoring Dashboard documentation | No dashboard docs exist today; the UI is a full-featured Next.js app that deserves dedicated documentation matching the pattern of existing docs pages |

### New Directories

| Type | Name | Location | Rationale |
|------|------|----------|-----------|
| Directory | `orchestration/` | `.github/orchestration/` | Consolidates runtime scripts and active schema within the single distributable tree; name matches the system's identity |
| Directory | `scripts/` | `.github/orchestration/scripts/` | Contains CLI entry points, lib modules, and tests; follows existing convention from `validate-orchestration/scripts/` |
| Directory | `tests/` | `.github/orchestration/scripts/tests/` | Co-locates test files with the scripts they test; eliminates the root `tests/` directory |
| Directory | `schemas/` | `.github/orchestration/schemas/` | Houses the promoted active schema; preserves naming from the original `plan/schemas/` |
| Directory | `archive/` | `archive/` | Replaces `plan/` as the home for historical design artifacts; name clearly signals "not current" |
| Directory | `schemas/` | `archive/schemas/` | Houses the 14 relic template files; preserves internal structure from `plan/schemas/` |
| Directory | `assets/` | `assets/` | Standard GitHub convention for static repository assets (screenshots, images) |

### New Assets

| Type | Name | Location | Rationale |
|------|------|----------|-----------|
| Image | `dashboard-screenshot.png` | `assets/dashboard-screenshot.png` | Visual representation of the monitoring dashboard for the README; PNG format for universal rendering support |

### README Section

| Type | Name | Position | Rationale |
|------|------|----------|-----------|
| Section | "Monitoring Dashboard" | After pipeline diagram, before Key Features | Highest-visibility position; provides immediate visual proof of the dashboard feature before a visitor reads any text descriptions |

### Documentation Table Entry

| Type | Name | Position | Rationale |
|------|------|----------|-----------|
| Table row | "Monitoring Dashboard" | After "Validation" row | Extends the existing documentation table with the new dashboard page; maintains the pattern of one row per docs page |
