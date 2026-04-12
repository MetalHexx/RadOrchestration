# Planning Document Refactor — Context & Decisions

> Reference document capturing decisions and analysis from brainstorming sessions for the BETTER-PLAN-DOCS project series. This is a living context doc — not a planning artifact.

## Series Overview

**BETTER-PLAN-DOCS** is a 6-project series that improves the orchestration planning pipeline documents. Each project targets one agent and the document(s) it owns.

| Project | Agent | Document(s) | Status |
|---------|-------|-------------|--------|
| BETTER-PLAN-DOCS-1 | Product Manager | PRD + `rad-create-plans` skill architecture | Brainstorming |
| BETTER-PLAN-DOCS-2 | Research | Research Findings | Draft |
| BETTER-PLAN-DOCS-3 | UX Designer | Design | Draft |
| BETTER-PLAN-DOCS-4 | Architect | Architecture | Draft |
| BETTER-PLAN-DOCS-5 | Tactical Planner (takes over from Architect) | Master Plan | Draft |
| BETTER-PLAN-DOCS-6 | Tactical Planner | Phase Plan + Task Handoff | Draft |

## North Star

Each planning document **owns what belongs to its layer**, references what upstream documents established, and **does not restate it**. Risks, goals, requirements — each scoped to the document type, not copied between documents.

- **Less repetition**: Eliminate content that appears in multiple documents (user stories restating FRs, risk sections in PRD/Architecture/Master Plan all covering the same risks, success metrics restating FRs)
- **Higher signal**: Every section in every document carries weight. If a section doesn't propagate downstream or provide unique insight at its layer, cut it
- **Lighter weight**: Shorter documents that are faster to produce and review without sacrificing traceability

## Key Decisions

### Pipeline Ordering: PRD Before Research

**Decision**: PRD runs before Research in `full.yml`.

**Rationale**: Research contaminates the PRD with implementation thinking. The DAG-VIEW-1 PRD references SSE connections, hook internals, and component-level details that leak from the Research Findings. A PM writing from brainstorming alone produces purer product-level requirements. Research then becomes *targeted by requirements* — the researcher knows which FRs need codebase investigation.

**Impact**: `full.yml` `depends_on` swap only. `quick.yml` stays unchanged (no PRD step).

**Affected files**:
- `templates/full.yml`: swap `depends_on` chains
- `references/action-event-reference.md`: update actions #1 and #2
- `references/context.md`: update pipeline flow diagram
- All skill input tables that reference PRD or Research ordering

### PRD Bloat Reduction

**Sections cut**:
- **User Stories**: 100% redundant with FRs. No downstream document references `US-1`. Dead weight
- **Assumptions**: Low/no signal. Risky assumptions belong in Risks
- **Success Metrics**: Restated FRs. "All routes resolve" = FR-1. Keep only for genuinely measurable non-FR targets (rare)
- **P0/P1/P2 Priority columns**: Execution priority belongs to the Tactical Planner and Master Plan phasing, not the PM. Everything in the PRD needs to get done — influencing order at PRD time is premature

**Sections kept**:
- **Problem Statement**: Essential framing (2-4 sentences)
- **Goals**: Plain bullets, no IDs. Framing tool, not a traceability artifact
- **Non-Goals**: High signal per byte. Prevents scope creep
- **Functional Requirements**: Core artifact. FR-1, FR-2, etc. propagate through Architecture, Master Plan, Phase Plans, Task Handoffs, Code Reviews
- **Non-Functional Requirements**: Core artifact. Same propagation as FRs
- **Risks**: Optional, product-scoped only. Technical risks aggregate in Architecture/Master Plan

### Chunk-Friendly Document Format

**Decision**: Structure all planning documents so that discrete elements (FRs, NFRs, risks, design components, architecture modules, phase tasks, etc.) each live under their own markdown heading rather than inside tables or dense lists.

**Rationale**: The future total-recall memory system chunks on markdown headers. Tables don't chunk well — a single table row may be too small to carry context, and a multi-row table is too large for a single chunk. Individual headings make each element a discrete, indexable chunk of 200-300 tokens. This applies across all document types in the series, not just PRD FRs/NFRs:
- **PRD**: FR/NFR headings (replaces table rows)
- **Research Findings**: Per-module or per-finding headings (replaces long prose or tables)
- **Design**: Per-component or per-flow headings
- **Architecture**: Per-module, per-contract, per-endpoint headings
- **Master Plan**: Per-phase, per-risk headings
- **Phase Plan / Task Handoff**: Per-task headings (already close to this pattern)

**Format convention** (heading level TBD per doc type — ### or ####):
```markdown
### FR-1: Short descriptive title

{Element text. 200-300 tokens max per chunk.}
```

Each document type's `workflow.md` in `rad-create-plans` specifies which elements get their own headings and at what level. The shared `references/shared/guidelines.md` defines the universal chunking rules (target size, heading conventions, what not to put in tables).

### Thin Agent Pattern

**Decision**: Planning agents become thin routers (like the coder agents). 1-2 sentence role description + skill pointer. All behavioral logic lives in the skill.

**Pattern** (modeled after `coder.agent.md`):
```markdown
You are the Product Manager Agent. You create PRDs.
Load the `rad-create-plans` skill — your document type is `prd`.
```

### Mega Skill: `rad-create-plans`

**Decision**: Consolidate document-creation skills into one `rad-create-plans` skill with agent-name self-routing.

**Structure**: Organized by document type. Each type gets its own folder under `references/` containing a `workflow.md` and a `templates/` subfolder with template variants. Shared conventions live in `references/shared/`.

```
skills/
  rad-create-plans/
    SKILL.md                                    # Router: shared refs + agent-based routing
    references/
      shared/
        guidelines.md                           # Chunk format, optional inputs, common rules
        self-review.md                          # rad-plan-audit folded in
      prd/
        workflow.md                             # PRD-specific workflow (BETTER-PLAN-DOCS-1)
        templates/
          PRD.md                                # Full PRD template
          PRD-light.md                          # Light PRD template
      research/
        workflow.md                             # (BETTER-PLAN-DOCS-2)
        templates/
          RESEARCH-FINDINGS.md
          RESEARCH-FINDINGS-light.md
      design/
        workflow.md                             # (BETTER-PLAN-DOCS-3)
        templates/
          DESIGN.md
          DESIGN-light.md
          DESIGN-FLOWS-ONLY.md
          DESIGN-NOT-REQUIRED.md
      architecture/
        workflow.md                             # (BETTER-PLAN-DOCS-4)
        templates/
          ARCHITECTURE.md
          ARCHITECTURE-light.md
      master-plan/
        workflow.md                             # (BETTER-PLAN-DOCS-5)
        templates/
          MASTER-PLAN.md
          MASTER-PLAN-light.md
      phase-plan/
        workflow.md                             # (BETTER-PLAN-DOCS-6)
        templates/
          PHASE-PLAN.md
      task-handoff/
        workflow.md                             # (BETTER-PLAN-DOCS-6)
        templates/
          TASK-HANDOFF.md
      phase-report/
        workflow.md                             # (BETTER-PLAN-DOCS-6)
        templates/
          PHASE-REPORT.md
```

**Routing**: Agent name self-routing. Each agent.md tells the skill what document type to produce. The SKILL.md loads `references/shared/` then routes to the appropriate `references/{doc-type}/workflow.md` which points at its local `templates/` folder.

**Migration**: Old `create-*` skills remain functional during the series. Each per-agent project migrates its document type into `rad-create-plans`. Final cleanup removes deprecated skills after all migrations complete.

**Self-review**: `rad-plan-audit` is absorbed as a shared reference (`references/shared/self-review.md`) invoked as a final workflow step in each document type's workflow.

### Optional Inputs Convention

**Decision**: Skill inputs marked as optional — agent uses judgment when a document isn't available. No explicit fallback instructions.

**Rationale**: The Orchestrator prompt and pipeline context already inform the agent what's available. Custom/lightweight pipelines may omit documents. The skill should adapt without hard stops.

### Risk Scoping Across Documents

**Decision**: Each document type owns risks at its layer:
- **PRD**: Product-level risks only (market, user adoption, scope)
- **Architecture**: Technical risks (integration, performance, dependency)
- **Master Plan**: Aggregated risk register from all upstream documents

No risk section restates another document's risks. The Master Plan aggregates and deduplicates.

## DAG Engine Analysis

The v5 DAG engine (`dag-walker.ts`) is **template-driven** — planning step order comes entirely from `depends_on` chains in the YAML template, not hardcoded in engine code. Changing the order is a template-only change:

- `engine.ts` `scaffoldState()` builds node states from template nodes dynamically
- `mutations.ts` registers handlers by event name (no ordering dependency)
- `context-enrichment.ts` maps action → step name (no ordering dependency)
- `walker` evaluates `checkDependencies()` against node states — if deps aren't `completed`/`skipped`, node is skipped

**No engine code changes required for reordering.**

## Evidence: DAG-VIEW-1 PRD Analysis

The DAG-VIEW-1 project documents were analyzed to identify bloat patterns:

- **User Stories → FRs**: Every US mapped 1:1 to an FR (US-1 = FR-2+FR-3, US-2 = FR-5, etc.)
- **Success Metrics → FRs**: "Functional parity" = FR-6, "Route accessibility" = FR-1+FR-7+FR-8
- **Research contamination**: PRD references SSE connections, hook internals, component names — implementation concepts the PM shouldn't know about at requirements time
- **Risk duplication**: PRD risks R-1 through R-4 appear nearly verbatim in the Master Plan risk register
