## Role Summary

You author the Master Plan — a single doc that enumerates every phase and
every task for the project, inlines the exact code / commands / files each
task needs, and tags every step with the requirement IDs it satisfies.

A well-written Master Plan is mechanical: a coder agent executing a task
does not need to open any other document to finish the work. Inlining is not
copy-paste; it is adaptation — each requirement is restated in the shape the
task needs, with the ID preserved.

This workflow does NOT load `references/shared/guidelines.md` or
`references/shared/self-review.md`. The authoring rules below are the full set.

## Inputs

| Input | Source | Required? |
|-------|--------|-----------|
| Requirements doc | `{PROJECT-DIR}/{NAME}-REQUIREMENTS.md` | Yes — source of every ID you will cite |
| Orchestrator prompt | Spawn context | Yes — project name, output path, scope bounds |
| Codebase | Workspace (via Grep/Glob/Read) | Yes — targeted discovery to write exact file paths and commands |

## Authoring principle

Each step inlines requirement content adapted to the task. You are not
rendering the Requirements doc — you are translating each ID into the specific
code change, command, or test the executor will run. The ID stays; the phrasing
becomes task-local and action-oriented.

## Workflow

### Steps

1. Read the Requirements doc. Build a mental inventory of every FR, NFR, AD,
   DD ID that must be addressed in the Master Plan. Every ID should land in
   at least one task. Unaddressed IDs = incomplete plan.

1a. **If a previous attempt failed the explosion script's parser, self-correct
    before re-drafting.**

    Read `state.graph.nodes.master_plan.last_parse_error` from `state.json`. If
    it is non-null, a previous attempt at this Master Plan failed the explosion
    script's parser. The field is structured:
    `{ line, expected, found, message }`.

    - Read the previous Master Plan at
      `state.graph.nodes.master_plan.doc_path` to see the prior output.
    - Fix the SPECIFIC issue identified by the parse error. Do not re-engineer
      the entire plan; address the formatting failure at the indicated line.
      Common parse failures:
        - `## P{NN}:` heading with missing / single-digit phase number.
        - `### P{NN}-T{MM}:` heading with a malformed id (e.g. `T-X`, `TX`).
        - Task heading appearing before any phase heading.
        - Task heading whose phase id does not match its enclosing phase.
        - Task block missing its `**Target repos:**` line entirely — fix by
          adding a `**Target repos:** <repo>` line immediately after
          `**Requirements:**`.
        - Task block has a `**Target repos:**` line that names zero repos (the
          value is blank or whitespace only) — fix by supplying at least one
          registry repo name on that line.
        - Task block names a repo in `**Target repos:**` that is not in the
          Master Plan's sealed frontmatter `repos:` set — fix by either
          changing the target repo to one already in the seal, or extending
          the frontmatter `repos:` seal to include the new repo (and
          cross-checking all phase-level `**Target repos:**` union lines).
      These repo-shape failures arrive through the identical structured
      `{ line, expected, found, message }` parse-error shape and the same
      hardcoded retry cap as the heading failures above, so apply the same
      narrow-fix discipline on retries 3+: address only the exact issue
      identified by `last_parse_error`; do not re-engineer the plan.
    - Re-emit the Master Plan with the correction. Other content stays as
      before unless explicitly impacted by the formatting fix.
    - The recovery loop has a hardcoded cap of 3 retries. After the cap, the
      pipeline halts via `rad-log-error` for manual intervention. Do not attempt
      new approaches on retry 3+; focus narrowly on fixing the exact parse
      error.

    If `last_parse_error` is null, skip this step and proceed normally.

2. Do targeted codebase discovery. Identify exact file paths you will create
   or modify, exact commands the test suite accepts, the testing framework in
   use, and any existing patterns the plan must follow. Grep / Glob / Read —
   no survey-level exploration.

2a. If your spawn prompt carried a `## Repository Skills Available` section,
    treat it as a discovery surface alongside Grep/Glob/Read. Scan the JSON
    array for entries whose `description` matches the work you are about to
    plan; `Read` each matching entry's absolute `path` directly (no Grep/Glob
    hunt — the manifest path is authoritative). **Skip entries whose
    descriptions do not match — do not Read every catalog entry.** The
    description is the screening surface; reading non-matches wastes tokens.
    If you encounter a `SKILL.md` via codebase Grep/Glob that is not in the
    catalog, do not Read it — the manifest is the complete authoritative
    list and any exclusions are intentional. Inline any commands,
    conventions, or code patterns the consulted skill prescribes into the
    relevant tasks under their requirement IDs. Absence of the section means
    no eligible repo skills exist; proceed normally.

2b. When no brainstorming doc and no Requirements `repos:` set are available,
    invoke the `/rad-repo` skill to read the registry and infer the affected
    repos from the orchestrator prompt and codebase discovery.
    When a Requirements `repos:` restate exists, seal it (refining only with
    cause) into the Master Plan frontmatter. The seal is derived bottom-up and
    cross-checked against the body's target repos before saving (see Step 8's
    structural lint pass). If you're absolutely have no clue which repos to check, 
    abort the operation and ask for help.

3. Decide the phase and task breakdown. Phases group work by natural seam
   (layer boundary, independently deliverable slice). Tasks within a phase are
   the smallest unit a single coder agent will execute end-to-end.

   **Plan size limits.** Your spawn prompt carries a `## Plan Size Limits`
   section with `max_phases` and `max_tasks_per_phase` (sourced from
   `orchestration.yml`). The breakdown must not exceed these. If natural
   seams suggest more phases or more tasks in a phase than the limit
   allows, consolidate — group more work per task, or fold thin phases
   together — rather than overflow. The pipeline silently caps any excess
   at expansion time, so overflow drops tail work without warning. Limits
   are an outer bound the Phase/Task Size rubric below operates within.

   **Phase/Task Size rubric** — The orchestrator's spawn prompt passes a
   `Task size preference` (one of `Small`, `Medium`, `Large`, `Extra Large`,
   or a `Custom: …` prose string). Apply the corresponding scope below.

   | Size | Task scope | Tasks per phase |
   |---|---|---|
   | Small | One named, self-contained change — a function, a validator, a constant. Precise enough to title in five words. | 3–5 |
   | Medium | A vertical slice through one layer: a module, a config section, a CLI command with its tests. | 2–4 |
   | Large | A full feature slice touching multiple layers or subsystems end-to-end. | 2–3 |
   | Extra Large | A standalone feature per task — scope that would be a phase at smaller sizes. Phases are thin wrappers. | 1–2 |
   | Custom | User-supplied prose is the criterion; apply it literally. | Planner judges from natural seams. |

   **Worked examples per size (code domain).**

   - *Small* — "Add a `maxRetries` config field: extend the schema type, add a bounds-validator function (`1–10`), and write test cases covering boundary values." One coherent unit; the title names exactly what ships.

   - *Medium* — "Author a password-reset flow: the `POST /auth/reset-request` endpoint, a signed-token generator, an email dispatch call, and integration tests for the happy path and expired-token case." A vertical slice through one layer; 2–4 such tasks make a phase.

   - *Large* — "Add OAuth login end-to-end: provider redirect handler, callback + session persistence, error-state responses, and an integration test suite covering the full flow." Touches auth, session, and routing layers; 2–3 such tasks make a phase.

   - *Extra Large* — "Build the full billing subsystem: plan-tier schema, Stripe webhook handler, invoice generation, customer portal redirect, and end-to-end smoke tests." Each task is what would be a phase at smaller sizes; 1–2 such tasks make a phase.

   **Edge cases.**

   - When natural seams fight the chosen size: respect the seams. If the
     requirements force three independent slices but the size says
     `Extra Large`, author three Extra Large tasks rather than one
     monolithic task that hides the seams.
   - When the chosen size produces fewer than 2 phases: that's fine for
     `Extra Large`. Single-phase plans are explicitly supported.
   - Phase scope is most meaningful in tiers with phase review
     (`extra-high`, `medium`). In `high` and `low` (no phase review),
     phase scope still affects pacing and commit cadence, but does not
     affect review overhead — do not over-index on phase boundaries
     in those tiers.

   **Interpreting `Custom` prose.** When the spawn prompt carries a
   `Task size preference: Custom: <user prose>` string, treat the prose
   as the authoritative scoping criterion for task scope. Apply
   natural-seam judgment for phase boundaries within the custom
   criteria. Do not fall back to a rubric tier silently — the user
   chose `Custom` precisely to override the rubric.

   The size governs scope per task, not step count within a task. TDD
   structure (4 RED-GREEN steps) is always required for `code` tasks
   regardless of size.

4. Author a `## Introduction` section. Under that heading, write one or two
   short paragraphs (2–3 sentences each) covering what is being built and why,
   at a glance. No phase-by-phase restatement.

5. For each phase, author a `## PNN: {Title}` section with this shape:

   ```markdown
   ## P01: {Phase Title}
   {≤3 sentence phase description.}

   **Requirements:** FR-1, FR-3, AD-2, DD-1
   **Target repos:** backend, frontend

   **Execution order:**
       T01 → T02
          → T03 → T04
       T05 (depends on T01-T04)

   ### P01-T01: {Task Title}
   ...
   ```

   - Phase numbers are zero-padded two digits: `P01`, `P02`, ...
   - Phase title: 3–6 words naming the deliverable. No verb-heavy procedure titles.
   - Phase description: lead with what the phase delivers as a whole — the capability or system state that exists when all tasks complete. No task enumeration or file lists.
   - The `**Requirements:**` line on the phase heading lists the union of
     requirement IDs its tasks address.
   - The `**Target repos:**` line on the phase heading is the union of the target repos of that phase's tasks, mirroring the placement and plural-form convention of the `**Requirements:**` line. (FR-8, DD-3, AD-4)
   - The execution-order block is an ASCII dependency tree. Use indentation,
     `→`, and parenthetical dependency notes. One block per phase.

6. For each task, author a `### PNN-TMM: {Title}` block with this shape:

   ```markdown
   ### P01-T01: {Task Title}
   {≤2 sentence task description.}

   **Task type:** code
   **Requirements:** FR-1, AD-2
   **Target repos:** backend, frontend
   **Files for backend:**
   - Create: `exact/path/to/new/file.ts`
   - Test: `tests/exact/path.test.ts`
   **Files for frontend:**
   - Modify: `exact/path/to/existing.ts:45-60`

   - [ ] **Step 1: Write the failing test (FR-1)**
       (exact test code inline)
   - [ ] **Step 2: Run test, confirm it fails**
       Run: `npm test -- login.test.ts`
       Expected: FAIL — {reason} (FR-1)
   - [ ] **Step 3: Implement minimal code (FR-1)**
       (exact implementation inline)
   - [ ] **Step 4: Run test, confirm pass**
       Run: `npm test -- login.test.ts`
       Expected: PASS (FR-1)
   ```

   **Title rule:** 4–7 words, imperative verb + outcome noun. Names what the task establishes, not what files it touches. Example: "Add rate-limit validator" not "Implement rate-limit validator function with allowlist constant and five test cases."

   **Intro rule:** Lead with the outcome — what this task establishes or enables. No file paths, no step enumeration; those live in the steps below. Two sentences maximum. Example: "Align the prompt-test suite naming with the four-tier vocabulary." not "Rename `prompt-tests/plan-pipeline-e2e/` → `prompt-tests/extra-high-pipeline-e2e/` and update all internal references."

7. Task rules:
   - `**Task type:**` is mandatory on every task. One of: `code` | `doc` |
     `config` | `infra`.
   - `**Requirements:**` is mandatory on every task. Lists IDs the task
     addresses. At least one ID.
   - `**Target repos:**` is mandatory on every task. A comma-separated list
     of registry repo names on a single line, placed alongside the
     `**Requirements:**` line (always plural-form, even for one name). This
     mirrors the `**Requirements:**` convention so the line stays stable and
     machine-greppable.
   - One `**Files for <repo>:**` subsection per named repo is mandatory; the
     task's `**Target repos:**` names every repo for which a subsection
     exists, and vice versa. Sub-bullets use `Create:` | `Modify:` | `Test:`
     | `Delete:` prefixes. There is no flat `**Files:**` block — the per-repo
     subsection is the only valid file-listing shape, uniform even for a
     single-repo task.
   - A single-repo task is visually identical to today's plan except the flat
     `**Files:**` label becomes `**Files for <repo>:**` and a one-name
     `**Target repos:**` line is added — keeping single-repo plans legible
     while making the shape uniform. Single-repo execution is unaffected
     because the new lines are inert body text the explosion script copies
     verbatim (it parses only `**Requirements:**`).
   - For `code` type: exactly 4 steps in the RED-GREEN shape:
     1. Write the failing test (inline code).
     2. Run the test, confirm it fails (exact command, expected-fail reason
        + `(FR-N)` tag).
     3. Implement the minimal code to pass (inline code).
     4. Run the test, confirm it passes (exact command + `(FR-N)` tag).
   - Non-code tasks (`doc`, `config`, `infra`) use an author-chosen step
     shape. No TDD required, but every step must still reference at least
     one requirement ID.
   - Test-quality anti-patterns during `code`-task authoring: no test-only methods in production code; no opaque mocks without documented purpose; no assertions that verify only mock behavior. These hide the test/production gap. Handoffs emitted from this plan inherit these constraints.
   - No meta tests asserting on test structure (e.g. "this test file has a test for each method in the implementation file") — tests should assert on production behavior, not test structure.
   - No placeholders. "TBD" / "implement later" / "similar to task N" /
     "as needed" — all prohibited. If you can't write it exactly, you
     aren't ready to write the plan.
   - Every step ends with at least one `(FR-N)` / `(NFR-N)` / `(AD-N)` /
     `(DD-N)` ID reference (inline in the expected-output line for run
     steps, inline in the description for write steps). This is the YAGNI
     gate — a step that doesn't trace to a requirement shouldn't exist.

7a. **Repo nesting invariants (planner self-check).** These are guidance,
    not machine-enforced — verify them by hand before saving:
    - Each task's `**Target repos:**` ⊆ the frontmatter `repos:` seal.
    - Each phase's `**Target repos:**` = the union of its tasks' target repos.
    - The frontmatter `repos:` seal = the union of all tasks' target repos.
    The seal is derived bottom-up from the tasks, not declared top-down.
    Cross-check the frontmatter against the body before saving.

8. Run a structural lint pass on your own authored text before saving:
   - Every `### {ID}:` task heading matches `### P\d{2}-T\d{2}:`.
   - Every task block carries a `**Task type:**` line.
   - Every task block carries a `**Requirements:**` line.
   - Every step begins with `- [ ] **Step N:`.
   - No `TBD`, `TODO`, `FIXME`, `implement later`, `similar to` strings
     appear anywhere in the body.
   - Every requirement ID cited by any task exists in the Requirements doc.
   - Every `### P\d{2}-T\d{2}:` task carries a `**Target repos:**` line and at least one matching `**Files for <repo>:**` subsection.
   - Every `## P\d{2}:` phase carries a `**Target repos:**` union line equal to the union of its tasks' target repos.
   - The frontmatter `repos:` seal is consistent with the body's target repos: it equals the union of every task's `**Target repos:**` value, and no body target-repos value falls outside the seal.

9. Save to `{PROJECT-DIR}/{NAME}-MASTER-PLAN.md`.

## Output Contract

**Filename**: `{NAME}-MASTER-PLAN.md` at project root.

**Frontmatter**:

```yaml
---
project: "{PROJECT-NAME}"
type: master_plan
status: "draft"
created: "{YYYY-MM-DD}"
repos: [repo-a, repo-b]
repo-group: repo-group-name 
total_phases: {N}
total_tasks: {N}
author: "planner-agent"
---
```

- `status`: `draft` | `approved`. Always `draft` at authoring time.
- `repos`: list of registry repo names — the **sealed, authoritative** repo set for the project. This is the single source of truth the explosion script will read; downstream documents are superseded by this seal.
- `repo-group`: the repo-group scope for this project.
- `total_phases`: count of `## P\d{2}:` headings.
- `total_tasks`: count of `### P\d{2}-T\d{2}:` headings.
- `author`: exactly `"planner-agent"`.

**Body section order**:

1. `# {PROJECT-NAME} — Master Plan` (H1 title)
2. `## Introduction` (1–2 paragraphs)
3. `## P01:`, `## P02:`, ... (one per phase)
4. `### P01-T01:`, `### P01-T02:`, ... (one per task within each phase)

## Constraints

- No "Additional Context" / "Appendix" / "Notes" catch-all sections. If it's
  not in a phase or task, it doesn't belong.
- No restating requirements verbatim. Inlining = adaptation.
- No cross-task references by name. If task T02 depends on T01, the
  dependency lives in the phase's execution-order ASCII tree, not in the task
  body.
- No commit step inside tasks. Commit cadence is owned by the source-control
  step elsewhere in the pipeline. (Logged as an open item — may revisit.)
- Every task is self-contained: a coder reading only this task plus the
  Requirements doc has everything needed to finish it.
