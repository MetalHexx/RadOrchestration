# Audit Rubric — Plan Audit

This rubric defines what counts as a genuine finding across both audit dimensions.
Apply it methodically. A false positive is as damaging as a missed issue.  We're 
not limited to these inconsistencies, so keep an eye out for other potential issues.

---

## Part 1: Codebase Accuracy (docs vs. code)

**Principle**: When a planning document makes a claim about existing code, is that claim correct?

### What to Check

For every reference a doc makes to existing code, verify the claim against the actual source file.

| Check | What to Verify | Example Finding |
|-------|---------------|-----------------|
| **Interface fields** | Field names, types, required vs. optional match the actual definition | Design says `body: NodeDef[]` but actual interface uses `children: NodeDef[]` |
| **Function signatures** | Parameter names, types, count, and return type match | Architecture says `loadTemplate(path, config)` but actual signature is `loadTemplate(path)` |
| **Constants and enums** | Names exist, values are correct, counts are accurate | Doc says "NEXT_ACTIONS has 20 entries" but the actual object has 21 |
| **File paths** | Paths to existing files are correct | Doc says `scripts/state-io.ts` but the file is at `scripts/lib/state-io.ts` |
| **Module responsibilities** | Description of what a module does matches its actual behavior | Doc says "template-loader.ts resolves names" but name resolution is in a different module |
| **Config fields and defaults** | Config keys and default values match what the code actually uses | Doc says `max_retries` defaults to 3 but code defaults to 5 |

### What Is NOT a Finding

Planned additions are never accuracy findings. If a doc says "we will create function X" or "this project adds interface Y", the absence of X or Y in the codebase is expected — that's the project scope.

The test: **does the doc claim this already exists?** If yes and the claim is wrong, it's a finding. If the doc says it will be created, skip it.

Signals that something is claimed as existing: present-tense descriptions of behavior, listed as a dependency of new code, appears in an "existing modules" or "unchanged modules" context, or the doc says "modify" or "update" rather than "create" or "add".

---

## Part 2: Cross-Document Cohesion (docs vs. docs)

**Principle**: Do all planning documents tell a consistent, traceable story from requirements through to execution?

The planning chain flows: **PRD → Research → Design → Architecture → Master Plan → Phase Plans**. Each downstream doc consumes upstream docs. Run these checks in order.

### 2.1 Requirement Traceability

Trace requirements from the PRD through to execution plans.

| Check | What to Verify |
|-------|---------------|
| **FR coverage in Architecture** | Every requirement (FR-*, NFR-*) in the PRD maps to at least one module or contract in the Architecture |
| **Master Plan key requirements** | The Master Plan's curated key requirements section traces back to actual FR/NFR IDs in the PRD — no invented requirements, no missing requirements |
| **Phase scope coverage** | Phase outlines in the Master Plan collectively cover all requirements — none left unaddressed |
| **NFR representation** | Non-functional requirements (NFR-*) from the PRD are reflected in Architecture's cross-cutting concerns or constraints |

The goal is not 1:1 mapping — it's that nothing falls through the cracks. A requirement with no trace into Architecture or phase scopes is a finding.

### 2.2 Design ↔ Architecture Alignment

Verify the Design and Architecture are describing the same system.

| Check | What to Verify |
|-------|---------------|
| **Component → module mapping** | Components defined in Design have corresponding modules or file paths in Architecture's module map |
| **Design flow feasibility** | User flows in Design are implementable given Architecture's module boundaries and contracts |
| **Design token consistency** | Design tokens or component props referenced in Design are compatible with Architecture's file structure and technology choices |

If the Design is a "not required" stub, skip this section — there's nothing to cross-check.

### 2.3 Master Plan Alignment

Master doc should align with all other docs.

| Check | What to Verify |
|-------|---------------|
| **Key requirements traceability** | The Master Plan's curated key requirements section traces back to actual FR/NFR IDs in the PRD — no invented requirements, no missing requirements |
| **Phase scope coverage** | Phase outlines in the Master Plan collectively cover all requirements — none left unaddressed |
| **Exit criteria alignment** | Exit criteria stated in the Master Plan for each phase match the exit criteria in the Phase Plan |
| **Terminology consistency** | Terms used in the Master Plan are consistent with upstream docs — no conflicting names or abbreviations |


### 2.4 Contract Consistency

Verify that contracts and interfaces are described identically everywhere they appear.

| Check | What to Verify |
|-------|---------------|
| **Interface shape stability** | An interface defined in Architecture has the same fields, types, and optionality when referenced in the Master Plan, Phase Plans, or Task Handoffs |
| **Module responsibility stability** | A module described as "responsible for X" in Architecture isn't described as "responsible for Y" in a different doc |
| **File path consistency** | The same file is referenced by the same path across all docs — no `/src/config.ts` in one doc and `/lib/config.ts` in another |
| **Frozen contract integrity** | Contracts marked as frozen, sacred, or NFR are not modified by any doc in the set — even additive changes |

### 2.5 Scope Alignment

Verify that the Master Plan's phase structure and downstream Phase Plans agree.

| Check | What to Verify |
|-------|---------------|
| **Phase count** | `total_phases` in Master Plan frontmatter matches the number of phase outline sections in the doc body |
| **Phase scope match** | Each phase's scope bullets in the Master Plan align with what the corresponding Phase Plan actually contains |
| **Exit criteria match** | Exit criteria stated in the Master Plan for each phase match the exit criteria in the Phase Plan |
| **No orphan tasks** | Every task in a Phase Plan traces back to a phase scope item in the Master Plan or a requirement in the PRD |
| **No orphan requirements** | Every requirement in the PRD is covered by at least one task across all Phase Plans |

If Phase Plans don't exist yet (pre-execution), check only Master Plan internal consistency (phase count, scope completeness).

### 2.6 Terminology Consistency

Verify that the same concept uses the same name across all documents.

| Check | What to Verify |
|-------|---------------|
| **Component/module names** | A component called "ConfigEditor" in Design isn't called "SettingsPanel" in Architecture |
| **Type and interface names** | An interface called `PipelineResult` in Architecture isn't called `PipelineOutput` in the Master Plan |
| **Event and action names** | Events or actions referenced by name are spelled and cased identically across all docs |
| **Abbreviations and acronyms** | Terms are used consistently — not "PR" in one doc and "pull request" in another when referencing a specific named concept |

Minor stylistic variation in prose is not a finding. This check targets **named technical artifacts** — types, modules, components, events, config keys — where inconsistency would cause a coder to implement the wrong thing or look for something that doesn't exist under that name.

---
