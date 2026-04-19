# Lint Report — baseline-rainbow-hello-2026-04-19

**Overall**: PASS. Both linters return zero errors on the inaugural-run docs; both self-tests surface their expected 6 errors each.

## Requirements doc lint

```
lint-requirements: <run-folder>/baseline-rainbow-hello-2026-04-19-REQUIREMENTS.md
  blocks: 8  errors: 0  warnings: 0
{"linter":"lint-requirements","ok":true,"errors":[],"warnings":[],"blockCount":8}
```

## Master Plan lint (with referential integrity against companion Requirements doc)

```
lint-master-plan: <run-folder>/baseline-rainbow-hello-2026-04-19-MASTER-PLAN.md
  phases: 3  tasks: 6  errors: 0  warnings: 0
{"linter":"lint-master-plan","ok":true,"errors":[],"warnings":[],"phaseCount":3,"taskCount":6}
```

## Self-test: lint-requirements

Exercises the six frontmatter/body/ID-sequence/count checks against an intentionally malformed in-memory fixture. Exits 0 with exactly 6 errors as expected.

```
lint-requirements: <self-test>
  blocks: 3  errors: 6  warnings: 0
  ERROR  frontmatter: expected `type: requirements`, got `not_requirements`
  ERROR  FR-1: missing body description sentence under heading
  ERROR  FR-3: missing body description sentence under heading
  ERROR  frontmatter.requirement_count (5) != actual block count (3)
  ERROR  FR-1: duplicate ID
  ERROR  FR-2: gap in ID sequence (missing)
```

## Self-test: lint-master-plan

Exercises phase/task counts, body-description presence, and frontmatter type. Referential integrity is intentionally NOT exercised in self-test mode (no companion Requirements doc on disk). Exits 0 with exactly 6 errors + 1 skip warning as expected.

```
lint-master-plan: <self-test>
  phases: 2  tasks: 2  errors: 6  warnings: 1
  ERROR  frontmatter: expected `type: master_plan`, got `not_master_plan`
  ERROR  frontmatter.total_phases (3) != actual phase count (2)
  ERROR  frontmatter.total_tasks (5) != actual task count (2)
  ERROR  P01: missing phase description sentence under heading
  ERROR  P02: missing phase description sentence under heading
  ERROR  P02-T01: missing task description sentence under heading
  WARN   companion requirements doc not found alongside master plan; skipping referential integrity check
Note: referential integrity check skipped in self-test mode (no companion requirements doc).
```
