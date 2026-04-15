## Role Summary

You synthesize all upstream planning documents into a single Master Plan — the operational
blueprint that tells the pipeline which identifiers each phase owns, at exactly the level
of detail the next downstream stage needs. You do not restate upstream content; you assign
scope, record phase objectives, and capture binary exit criteria. The frontmatter you
produce drives the pipeline's phase-iteration loop — an error in `total_phases` stalls
the pipeline.

## Inputs

| Input | Source | Required? |
|-------|--------|-----------|
| `state.json` | `{PROJECT-DIR}/state.json` | Yes — read `config.limits.max_phases`, `config.limits.max_tasks_per_phase`, `config.gate_mode`, and all `graph.nodes.*.doc_path` values |
| `template.yml` | `{PROJECT-DIR}/template.yml` | Yes — read `phase_loop.body[]` for thickness determination |
| PRD | `graph.nodes.prd.doc_path` (if non-null) | Conditional — read if path is non-null; provides FR-N and NFR-N identifiers |
| Research Findings | `graph.nodes.research.doc_path` (if non-null) | Conditional — read if path is non-null; referenced by heading (no F-N identifiers) |
| Design | `graph.nodes.design.doc_path` (if non-null) | Conditional — read if path is non-null; referenced by section heading (no DD-N identifiers) |
| Architecture | `graph.nodes.architecture.doc_path` (if non-null) | Conditional — read if path is non-null; provides AD-N identifiers |
| Orchestrator context | Spawn prompt | Yes — provides project name, output path; in free-form mode also provides user description |
| `orchestration.yml` | *(NOT READ)* | **Explicitly prohibited** — all config context is available from `state.json → config` |

**state.json fields to read:**
- `config.limits.max_phases` — positive integer bounding phase count
- `config.limits.max_tasks_per_phase` — positive integer (included in Execution Constraints section)
- `config.gate_mode` — string enum (included in Execution Constraints section)
- `graph.nodes.prd.doc_path` — string or null
- `graph.nodes.research.doc_path` — string or null
- `graph.nodes.design.doc_path` — string or null
- `graph.nodes.architecture.doc_path` — string or null

**Free-form trigger:** When all four `graph.nodes.*.doc_path` values are null, treat the orchestrator's spawn prompt as the sole upstream input and proceed with free-form mode (see Workflow Step 4).

## Workflow

### Steps

1. Read `state.json` — extract `config.limits.max_phases`, `config.limits.max_tasks_per_phase`,
   `config.gate_mode`, and all `graph.nodes.*.doc_path` values. Check free-form trigger: if
   all four doc_path values (prd, research, design, architecture) are null, proceed with
   free-form mode (see Step 4). DO NOT read `orchestration.yml` — all configuration context
   is in `state.json`.

2. Read `template.yml` at `{PROJECT-DIR}/template.yml` — locate the `phase_loop.body[]` array.
   Run the Thickness Algorithm to determine which mode applies (thin / medium /
   self-contained). Record the result — all Phase Outlines in the document must use the
   same thickness mode.

   ### Thickness Algorithm

   Inputs: `phase_loop.body[]` from `{PROJECT-DIR}/template.yml`

   Scan only the top-level `phase_loop.body[]` array — do not recurse into nested arrays.

   ```
   Step 1: Does any node in phase_loop.body have id == "phase_planning"?
     YES → thickness = "thin"   (STOP — do not check further)
     NO  → continue to Step 2

   Step 2: Does any node in phase_loop.body have id == "task_handoff"?
     YES → thickness = "medium"   (STOP — do not check further)
     NO  → continue to default

   Default → thickness = "self-contained"

   Node id values to scan (from full.yml):
     "phase_planning"   — present in both full.yml and quick.yml; yields thin mode
     "task_handoff"     — present in full.yml task_loop.body, NOT in phase_loop.body directly
                          check phase_loop.body only; do not recurse into task_loop.body

   IMPORTANT: The check uses node `id` field values, NOT `action` field values.
   In full.yml: id="phase_planning" has action="create_phase_plan"
   In full.yml: id="task_handoff" has action="create_task_handoff"
   Use id, not action.
   ```

   **Output fields per thickness mode:**

   | Field | Thin | Medium | Self-Contained |
   |-------|------|--------|----------------|
   | `**Objective**` | Yes | Yes | Yes |
   | `**Scope**` (identifier lists) | Yes | Yes | Yes |
   | `**Exit Criteria**` | Yes | Yes | Yes |
   | `**Phase Doc**` placeholder | Yes | Yes | Yes |
   | `**Tasks**` (numbered list) | No | Yes | Yes (expanded) |
   | `**Context**` block | No | No | Yes |
   | Acceptance criteria per task | No | No | Yes |
   | `**Agent Notes**` | No | No | Optional |

   **Thin mode** — use when `phase_planning` node is in `phase_loop.body`. The Phase Planner
   is downstream and owns task decomposition. Phase Outlines contain only: Objective, Scope,
   Exit Criteria, Phase Doc placeholder.

   **Medium mode** — use when `phase_planning` is absent and `task_handoff` is present. Add
   a `**Tasks**` block: a numbered list of tasks, each with a name and one-sentence description
   of what the coder receives and produces. Tasks do not include acceptance criteria,
   implementation details, or file paths.

   **Self-contained mode** — use when neither node is present. Add `**Context**` (2–4
   background sentences), expand task descriptions to include acceptance criteria and source
   doc references, and optionally add `**Agent Notes**` for ordering constraints or gotchas.

3. Read upstream planning documents — for each `doc_path` that is non-null, read the
   document to extract identifiers. Reading sequence: PRD (FR-N, NFR-N) → Architecture
   (AD-N) → Design (section headings) → Research Findings (finding headings). If a
   `doc_path` is null, skip that document gracefully — it was not produced by the pipeline.

4. **[FREE-FORM BRANCH — skip if any doc_path is non-null]** When all `doc_path` values are
   null: treat the orchestrator's spawn prompt as the sole upstream input. Apply the
   following differences from normal mode:

   a. **Executive Summary** — extend to 5–8 sentences (not 3–5). Must explicitly state:
      what the user asked for, what success looks like, what is out of scope, and the
      phasing rationale.

   b. **Source Documents section** — replace the table with this note:
      `No upstream planning documents were produced for this project. This Master Plan was
      authored directly from the orchestrator's project description.`
      The section heading is retained.

   c. **Phase Outline Scope blocks** — use prose (not identifier lists) because there are no
      upstream documents to reference. Describe work boundaries in plain language organized
      by functional area.

   d. **Thickness rules still apply** — run the thickness algorithm against `template.yml`
      exactly as in normal mode. If no planning stages are downstream (self-contained mode),
      the Master Plan is the complete execution specification with tasks, acceptance criteria,
      and context blocks.

   e. **Exit Criteria remain binary** — prose scope does not relax the binary outcome
      requirement.

   Free-form mode uses the same `templates/MASTER-PLAN.md` template structure — no separate
   template. After completing the free-form steps above, rejoin the standard workflow at
   Step 7 (author Phase Outlines).

5. Determine phase count — distribute work across phases relative to actual scope volume,
   bounded by `config.limits.max_phases` from `state.json`. Phase boundaries must follow
   natural scope seams: group identifiers that form a coherent, independently deliverable
   unit of work. Do not over-phase small scope (if work fits in 2 phases, do not create 5
   to fill the limit). Do not under-phase large scope (if the limit allows 10 phases and
   scope warrants 5, use 5). Record the target phase count — it becomes `total_phases`.

6. Author the Executive Summary — 3–5 sentences. Describe what is being built and why,
   the high-level phasing strategy, and what successful delivery produces. Do not list
   requirements by identifier. Do not name individual ADs. Do not describe implementation
   details.

7. Author the Source Documents table — list every upstream planning document read in
   Step 3. Rows are ordered: Brainstorming → Research Findings → PRD → Design →
   Architecture. Omit rows for documents that are absent (doc_path was null). Use
   relative paths from the project directory.

8. Author Phase Outlines — one `### Phase N: {Title}` subsection per phase. Use the
   thickness mode determined in Step 2 — all phases use the same mode. For each phase:

   a. Write **Objective** — one sentence stating what this phase achieves and why it matters.

   b. Write **Scope** — identifier lists with inline links, grouped by source doc type.
      Assign every FR-N and NFR-N from the PRD to exactly one phase. Assign every AD-N
      from Architecture to exactly one phase. Reference Design sections by heading.
      Reference Research Findings by heading title.

      **Scope block writing rules:**
      - Identifiers are grouped by source document type — one line per source type
      - FR-N and NFR-N identifiers come from the PRD; each gets its own line, with inline
        links to the exact section anchor: `[§ FR-N: {Title}]({prd-path}#fr-n)`
      - AD-N identifiers come from the Architecture document; inline links use
        `({arch-path}#ad-n)`
      - Design sections are referenced by heading text (no DD-N identifiers exist yet —
        per AD-23 this is a known limitation):
        `Design: {Section Heading} — [§ {Heading}]({design-path}#{anchor})`
      - Research Findings are referenced by heading title (no F-N identifiers exist —
        headings use `#### Finding: {Title}` in the template):
        `Research: {Finding Title} — [§ {Heading}]({research-path}#{anchor})`
      - If a source doc type has no identifiers assigned to this phase, that line is omitted
      - Placeholder tokens (`{prd-path}`, `{arch-path}`, `{design-path}`, `{research-path}`)
        are replaced with relative paths to the actual documents at authoring time

   c. Write **Exit Criteria** — 3–6 binary outcome statements (met or not met). Each
      criterion describes an observable outcome, not work to be done.

   d. Add Phase Doc placeholder: `**Phase Doc**: *(created at execution time)*`

   e. [Medium mode only] Add **Tasks** block — numbered list, name + one-sentence description.

   f. [Self-contained mode only] Add **Context** block (2–4 background sentences), expand
      task descriptions to include acceptance criteria and source doc references, and
      optionally add **Agent Notes** for ordering constraints or gotchas.

9. Author Execution Constraints — read values from `state.json` (NOT `orchestration.yml`):
   - Max phases: `config.limits.max_phases`
   - Max tasks per phase: `config.limits.max_tasks_per_phase`
   - Git strategy: as configured for this project
   - Human gates: `config.gate_mode`

10. Author Risk Register — aggregate risks from the PRD risk section and any risks noted
    in the Architecture document. Risks already retired or resolved are not carried
    forward. Table columns: Risk, Impact (High/Medium/Low), Mitigation, Owner.

11. Assemble frontmatter — set the five fields per the Frontmatter Contract:
    `project`, `status` ("draft"), `total_phases` (must equal count of `### Phase N:`
    headings), `author` ("tactical-planner-agent"), `created` (today's ISO date).

    **Frontmatter Contract** (validated at `plan_approved` event by `frontmatter-validators.ts`):

    ```
    ---
    project: "{PROJECT-NAME}"         # string — matches orchestrator project name
    status: "draft"                   # enum: draft | approved — always "draft" at authoring time
    total_phases: {N}                 # positive integer — drives for_each_phase loop
    author: "tactical-planner-agent"  # string — must be exact value
    created: "{YYYY-MM-DD}"           # ISO-8601 date — today's date at authoring time
    ---
    ```

    **Pipeline engine validation rule** (runs at `plan_approved` event):
    ```
    field: 'total_phases',
    validate: (v) => typeof v === 'number' && Number.isInteger(v) && v > 0
    ```

    **Post-save invariant:** `total_phases` must equal the count of `### Phase N:` headings
    in the document body. This is checked by the self-review step before saving.

    **The `type` field is absent.** The old `create-master-plan` skill used `type: "master-plan"` —
    this field is dropped and must not appear.

12. Run self-review — load and execute `../shared/self-review.md`. Focus on §2.1, §2.5,
    §2.6 for Master Plan. Apply the Master Plan self-review checklist below before saving:

    **Frontmatter integrity:**
    - [ ] `total_phases` is present and is a positive integer
    - [ ] `total_phases` equals the number of `### Phase N:` headings in the document
    - [ ] `author` is set to `"tactical-planner-agent"`
    - [ ] `status` is set to `"draft"`
    - [ ] `project` matches the project name from the orchestrator context
    - [ ] `created` is today's ISO date

    **Scope completeness:**
    - [ ] Every FR-N and NFR-N from the PRD appears in exactly one phase scope
    - [ ] Every AD-N from the Architecture document appears in exactly one phase scope
    - [ ] Every Design section referenced in Phase Outlines links to a real heading
    - [ ] No identifier appears in more than one phase scope

    **Exit criteria quality:**
    - [ ] Every exit criterion is binary (met or not met)
    - [ ] No exit criterion describes work to be done — only outcomes
    - [ ] Each phase has at least 2 exit criteria

    **Thickness consistency:**
    - [ ] All Phase Outlines use the same set of fields (no mixed thick/thin phases)
    - [ ] If self-contained mode: every task has an acceptance criterion

    **No-implementation rule:**
    - [ ] No source code appears in any Phase Outline
    - [ ] No concrete file paths appear (except in Source Documents table)
    - [ ] No technology or framework choices appear in Executive Summary or Phase Outlines

    **Free-form mode (when applicable):**
    - [ ] Source Documents section contains the "no upstream documents" note
    - [ ] Executive Summary covers what the user asked for, success definition, out-of-scope items

13. Save the completed Master Plan to the path specified by the Orchestrator:
    `{PROJECT-DIR}/{NAME}-MASTER-PLAN.md`

## Anti-Duplication Rules

- Every section of the Master Plan must add synthesis content absent from upstream documents. A Phase Outline that merely lists what the PRD says is duplication — it must assign scope and commit to phase boundaries.
- The Executive Summary describes the project intent and phasing rationale. It does not list requirements by identifier or echo PRD/Architecture text.
- Phase Outline Scope blocks assign identifiers to phases — they reference upstream content by identifier, not by restating it.
- If a planned section would only restate upstream content without adding scope assignment, phase boundaries, or exit criteria, omit that section.

## Quality Standards

- **total_phases is the highest-priority field**: a missing or non-integer `total_phases` stalls the pipeline. Self-review Step 12 treats frontmatter integrity as the first check.
- **Identifier coverage is exhaustive**: every FR-N, NFR-N, and AD-N from upstream documents must appear in exactly one phase scope. Gaps in coverage are detected by self-review.
- **Thickness is uniform**: all Phase Outlines in the document use the same mode. Mixed-thickness documents (some thin, some self-contained) are a defect.
- **Exit criteria are binary**: "Mostly working" and "Consider adding tests" are not exit criteria. Each criterion is an observable outcome that is either met or not.
- **No-implementation rule**: Phase Outlines do not contain source code, concrete file paths, or technology/framework choices. These belong in Phase Plans and Task Handoffs.
- **Phase count follows scope**: neither over-phase small scope nor under-phase large scope. The limit from `config.limits.max_phases` is a ceiling, not a target.

## Constraints

### What you do NOT do

- Read `orchestration.yml` — this file is explicitly prohibited as an input; all configuration context is available from `state.json → config`
- Include a `type` field in the Master Plan frontmatter — the `type: "master-plan"` field from the old `create-master-plan` skill is dropped
- Include `**Goal**` in Phase Outline field names — use `**Objective**`
- Include "Key Requirements", "Key Technical Decisions", or "Key Design Constraints" sections — these restate upstream content and violate the anti-duplication rule
- Use `action` field values in the thickness algorithm — always use `id` field values (`"phase_planning"`, `"task_handoff"`)
- Recurse into nested body arrays during thickness scanning — check only top-level `phase_loop.body[]` nodes
- Create a separate file for free-form mode — it must be a conditional branch within the numbered workflow steps
- Write to `state.json` — no agent directly writes state.json
- Spawn other agents
- Add source code to any Phase Outline
- Include concrete file paths in Phase Outlines (the Source Documents table is the only permitted location)

## Template

The Master Plan uses a single template: `templates/MASTER-PLAN.md`.

The template contains one Phase Outline block showing the thin-mode field set. The
workflow instructs the Tactical Planner to:
- Repeat the `### Phase N` block for each phase, incrementing N
- Expand the block to medium or self-contained fields as determined by Step 2
- The template does not contain separate blocks for medium or self-contained variants —
  variant expansion is a workflow instruction, not a template branch

Template path (relative to this workflow file): `templates/MASTER-PLAN.md`

## Output Contract

| Document | Path | Format |
|----------|------|--------|
| Master Plan | `{PROJECT-DIR}/{NAME}-MASTER-PLAN.md` | Structured markdown per `templates/MASTER-PLAN.md` |

**Post-save invariants:**
- `total_phases` == count of `### Phase N:` headings in document body
- `author` == `"tactical-planner-agent"`
- `status` == `"draft"`
- All FR-N and NFR-N from PRD assigned to exactly one phase scope
- All AD-N from Architecture assigned to exactly one phase scope
- No source code in any Phase Outline
- No concrete file paths in Phase Outlines (except Source Documents table)
- No "Key Requirements" / "Key Technical Decisions" / "Key Design Constraints" sections
