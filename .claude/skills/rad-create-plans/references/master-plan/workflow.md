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
    hunt — the manifest path is authoritative). Inline any commands,
    conventions, or code patterns the consulted skill prescribes into the
    relevant tasks under their requirement IDs. Absence of the section means
    no eligible repo skills exist; proceed normally.

3. Decide the phase and task breakdown. Phases group work by natural seam
   (layer boundary, independently deliverable slice). Tasks within a phase are
   the smallest unit a single coder agent will execute end-to-end.

   **Task sizing rubric** — If the orchestrator's spawn prompt includes a
   `Task size preference`, apply the corresponding scope below. If no
   preference was passed ("Planner Decides"), use your own judgment.

   | Tier | Task scope guidance |
   |---|---|
   | Small | One file or one function. Fine-grained, isolated. Maximize task count. |
   | Medium | 2–4 files, one coherent unit of work. Balanced scope and overhead. |
   | Large | Cross-cutting change or full feature slice. Fewer tasks, higher complexity per task. |
   | Extra Large | End-to-end feature per task. Minimal task count; requires a capable model. |
   | Planner Decides | No constraint — use judgment based on natural seams in the requirements. |

   The tier governs scope per task, not step count within a task. TDD
   structure (4 RED-GREEN steps) is always required for `code` tasks
   regardless of tier.

4. Author a `## Introduction` section. Under that heading, write one or two
   short paragraphs (2–3 sentences each) covering what is being built and why,
   at a glance. No phase-by-phase restatement.

5. For each phase, author a `## PNN: {Title}` section with this shape:

   ```markdown
   ## P01: {Phase Title}
   {≤3 sentence phase description.}

   **Requirements:** FR-1, FR-3, AD-2, DD-1

   **Execution order:**
       T01 → T02
          → T03 → T04
       T05 (depends on T01-T04)

   ### P01-T01: {Task Title}
   ...
   ```

   - Phase numbers are zero-padded two digits: `P01`, `P02`, ...
   - The `**Requirements:**` line on the phase heading lists the union of
     requirement IDs its tasks address.
   - The execution-order block is an ASCII dependency tree. Use indentation,
     `→`, and parenthetical dependency notes. One block per phase.

6. For each task, author a `### PNN-TMM: {Title}` block with this shape:

   ```markdown
   ### P01-T01: {Task Title}
   {≤2 sentence task description.}

   **Task type:** code
   **Requirements:** FR-1, AD-2
   **Files:**
   - Create: `exact/path/to/new/file.ts`
   - Modify: `exact/path/to/existing.ts:45-60`
   - Test: `tests/exact/path.test.ts`

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

7. Task rules:
   - `**Task type:**` is mandatory on every task. One of: `code` | `doc` |
     `config` | `infra`.
   - `**Requirements:**` is mandatory on every task. Lists IDs the task
     addresses. At least one ID.
   - `**Files:**` block is mandatory on every task. Sub-bullets use
     `Create:` | `Modify:` | `Test:` | `Delete:` prefixes.
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
   - No placeholders. "TBD" / "implement later" / "similar to task N" /
     "as needed" — all prohibited. If you can't write it exactly, you
     aren't ready to write the plan.
   - Every step ends with at least one `(FR-N)` / `(NFR-N)` / `(AD-N)` /
     `(DD-N)` ID reference (inline in the expected-output line for run
     steps, inline in the description for write steps). This is the YAGNI
     gate — a step that doesn't trace to a requirement shouldn't exist.

8. Run a structural lint pass on your own authored text before saving:
   - Every `### {ID}:` task heading matches `### P\d{2}-T\d{2}:`.
   - Every task block carries a `**Task type:**` line.
   - Every task block carries a `**Requirements:**` line.
   - Every step begins with `- [ ] **Step N:`.
   - No `TBD`, `TODO`, `FIXME`, `implement later`, `similar to` strings
     appear anywhere in the body.
   - Every requirement ID cited by any task exists in the Requirements doc.

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
total_phases: {N}
total_tasks: {N}
author: "planner-agent"
---
```

- `status`: `draft` | `approved`. Always `draft` at authoring time.
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
