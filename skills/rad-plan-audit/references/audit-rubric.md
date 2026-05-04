# Audit Rubric — Plan Audit

This rubric defines what counts as a genuine finding. The planning set
comprises exactly two documents: the `{NAME}-REQUIREMENTS.md` ledger
(FR / NFR / AD / DD) and the inlined `{NAME}-MASTER-PLAN.md`. Phase
Plans and Task Handoffs are deterministic explosion artifacts validated
elsewhere by `rad-code-review`; they are out of scope here.

Apply the rubric methodically. A false positive is as damaging as a missed
issue.

## Calibration

Only flag issues that would block a coder during implementation.
Stylistic preferences, minor wording, and nice-to-have suggestions are
not findings. Bias toward approval unless there are serious gaps —
missing requirements from the ledger, contradictory steps, placeholder
content, broken tag references, or tasks so vague they cannot be acted
on.

When uncertain, do not flag. A noisy audit loses signal; a conservative
one keeps it.

---

## Part 1: Codebase Accuracy (docs vs. code)

**Principle**: When a planning document makes a claim about existing
code, is that claim correct?

### What to Check

For every reference a doc makes to existing code, verify the claim
against the actual source file.

| Check | What to Verify | Example Finding |
|-------|---------------|-----------------|
| **Interface fields** | Field names, types, required vs. optional match the actual definition | Requirements doc says `body: NodeDef[]` but actual interface uses `children: NodeDef[]` |
| **Function signatures** | Parameter names, types, count, and return type match | Master Plan says `loadTemplate(path, config)` but actual signature is `loadTemplate(path)` |
| **Constants and enums** | Names exist, values are correct, counts are accurate | Doc says "NEXT_ACTIONS has 20 entries" but the actual object has 21 |
| **File paths** | Paths to existing files are correct | Task says `Modify: scripts/state-io.ts` but the file is at `scripts/lib/state-io.ts` |
| **Module responsibilities** | Description of what a module does matches its actual behavior | Doc says "template-loader.ts resolves names" but name resolution is in a different module |
| **Config fields and defaults** | Config keys and default values match what the code actually uses | Doc says `max_retries` defaults to 3 but code defaults to 5 |

### What Is NOT a Finding

Planned additions are never accuracy findings. If a doc says "we will
create function X" or "this project adds interface Y", the absence of X
or Y in the codebase is expected — that's the project scope.

The test: **does the doc claim this already exists?** If yes and the
claim is wrong, it's a finding. If the doc says it will be created, skip
it.

Signals that something is claimed as existing: present-tense descriptions
of behavior, listed as a dependency of new code, appears in an "existing
modules" context, or the doc says "modify" / "update" rather than
"create" / "add".

---

## Part 2: Cross-Document Cohesion (docs vs. docs)

**Principle**: Do the Requirements doc and Master Plan tell the same
story — every cited ID exists, every requirement is addressed, every
named artifact uses a single canonical name?

### 2.1 Requirement Coverage

Trace IDs both directions between Requirements and Master Plan.

| Check | What to Verify |
|-------|---------------|
| **Forward coverage** | Every FR / NFR / AD / DD block in the Requirements doc is cited in at least one task's `**Requirements:**` line or in a phase's `**Requirements:**` line. Unaddressed IDs = coverage gap. |
| **Reverse validity** | Every ID cited in the Master Plan (phase `**Requirements:**`, task `**Requirements:**`, or inline step tag) exists as a `### FR-N:` / `### NFR-N:` / `### AD-N:` / `### DD-N:` block in the Requirements doc. Phantom IDs = invalid citation. |
| **Phase roll-up** | Each phase's `**Requirements:**` line is the union of the IDs cited by that phase's tasks. No phase-level ID that no task implements; no task ID that the phase heading omits. |

The goal is not a 1:1 mapping — it's that nothing falls through the
cracks and nothing is cited that doesn't exist.

### 2.2 Contract Consistency

Verify that contracts and interfaces are described identically everywhere
they appear across the two docs.

| Check | What to Verify |
|-------|---------------|
| **Interface shape stability** | An interface named in the Requirements doc has the same fields, types etc. |
| **Module responsibility stability** | A module described as "responsible for X" in the Requirements doc isn't described as "responsible for Y" in a Master Plan task body. |
| **File path consistency** | The same file is referenced by the same path in both docs — no `/src/config.ts` in Requirements and `/lib/config.ts` in a task's `**Files:**` block. |
| **Frozen contract integrity** | Contracts marked frozen, sacred, or NFR-constrained in the Requirements doc are not modified by any task — even additively. |

### 2.3 Terminology Consistency

Verify that the same concept uses the same name across both documents.

| Check | What to Verify |
|-------|---------------|
| **Component/module names** | A component called "ConfigEditor" in Requirements isn't called "SettingsPanel" in a Master Plan task. |
| **Type and interface names** | An interface called `PipelineResult` in Requirements isn't called `PipelineOutput` in a task. |
| **Event and action names** | Events or actions referenced by name are spelled and cased identically in both docs. |

Minor stylistic variation in prose is not a finding. This check targets
**named technical artifacts** — types, modules, components, events,
config keys — where inconsistency would cause a coder to implement the
wrong thing or look for something that doesn't exist under that name.

### 2.4 Decision Encapsulation

Verify Requirements blocks are self-contained and conclusive. An AD/DD
block that defers its own claim to future work creates performative tasks
downstream.

| Check | What to Verify |
|-------|---------------|
| **No downstream doc references** | Requirements block bodies do not name the Master Plan, phase plan, task handoff, or "execution" in any context. Strict grep targets: `Master Plan`, `phase plan`, `task handoff`. Any match is a finding. |
| **No deferred-work verbs** | Requirements block bodies do not contain deferred-work phrasing. Grep targets: `will be verified`, `will be enumerated`, `pending confirmation`, `to be decided`, `audit task`, `discovery task`, `enumeration task`, `investigation task`. |
| **No conditional decisions** | An AD/DD whose stated decision is contingent on a future verification described as happening elsewhere is not a decision — it is a deferral, and must be resolved at Requirements-authoring time. |

A finding in §2.4 is severity `high` — deferred Requirements produce
performative Master Plan tasks that survive through explosion, execution,
and review.

---

## Part 3: Buildability (Explosion-Readiness)

**Principle**: The Master Plan is the contract a coder executes. When
the explosion script splits it into per-task handoffs, each handoff must
be self-contained and grounded. Defects in the Master Plan propagate
directly into unsolvable task handoffs.

Authoritative source for the structural rules below:
`.claude/skills/rad-create-plans/references/master-plan/workflow.md`,
especially step 7 (task rules + YAGNI gate).

### What to Check

| Check | What to Verify |
|-------|---------------|
| **Tag coverage** | Every ID (FR / NFR / AD / DD) in the Requirements doc appears in at least one task. This is the Requirements → Master Plan completeness gate. |
| **Tag justification** | Every task includes at least one `(FR-N)` / `(NFR-N)` / `(AD-N)` / `(DD-N)` tag.  The YAGNI gate: a task that doesn't trace to a requirement shouldn't exist. |
| **Tag validity** | Every tag cited anywhere in the Master Plan (phase heading, task heading, step line) resolves to an ID block in the Requirements doc. No phantom `FR-99` / `AD-12` citations. |
| **Phase heading shape** | Every `## P\d{2}:` heading carries a `**Requirements:**` line. Phase numbers are zero-padded two digits. |
| **Task heading shape** | Every `### P\d{2}-T\d{2}:` heading carries three mandatory lines: `**Task type:**` (one of `code` / `doc` / `config` / `infra`), `**Requirements:**`, and `**Files:**` (with `Create:` / `Modify:` / `Test:` / `Delete:` sub-bullets). |
| **`code` task RED-GREEN shape** | Every task with `**Task type:** code` contains exactly four steps in order: (1) write the failing test, (2) run the test and confirm failure, (3) implement the minimal code, (4) run the test and confirm pass. |
| **No placeholders** | No `TBD`, `TODO`, `FIXME`, `implement later`, `similar to`, `as needed` anywhere in the Master Plan body. |
| **No vague language** | No "if needed", "optional", "as appropriate", "investigate", "explore", "consider" — any language that leaves the coder unsure of what to do. |
| **Grounded file paths** | `Modify:` and `Delete:` paths exist on disk. `Create:` paths do not exist yet, but their parent directories do. |

If any of the first three (coverage / justification / validity) fails,
the plan is not buildable — the explosion will succeed syntactically but
the resulting handoffs will mislead the coder.

---

## Finding Format

Every finding is one row in a structured table. The audit report groups
findings by pillar (Part 1 / Part 2 / Part 3).

| Column | Description |
|--------|-------------|
| **F-N** | Stable finding ID, 1-based, unique within the report. `F-1`, `F-2`, ... |
| **Document** | Which doc the finding is in — `Requirements`, `Master Plan`, or `Both`. |
| **Pillar** | `Codebase Accuracy` / `Cross-Document Cohesion` / `Buildability`. |
| **Severity** | `high` (would block a coder) / `medium` (likely to cause rework) / `low` (minor gap worth noting). Calibration applies — most findings will be `high` or `medium`. |
| **Finding** | One short sentence naming the defect. |
| **Evidence** | Concrete pointer: `File:Line` into the planning doc, plus a quoted fragment or a pair of conflicting quotes. |
| **Ground Truth** | What the correct state looks like — a source-code citation for Part 1, the authoritative doc location for Parts 2/3, or the structural rule being violated. |

Example row:

```
| F-1 | Master Plan | Buildability | high | P01-T03 step 3 is missing a requirement tag | `{NAME}-MASTER-PLAN.md:142` — "Implement the minimal code" | master-plan/workflow.md step 7: every step ends with at least one `(FR-N)` / `(NFR-N)` / `(AD-N)` / `(DD-N)` tag |
```

### Verdict

The report ends with a single line:

```
Verdict: approved
```

or

```
Verdict: issues_found
```

`approved` means zero findings at any severity. `issues_found` means at
least one finding was recorded. The orchestrator keys the next step off
this line.
