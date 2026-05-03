# Lint Report — baseline-instructions-canary-2026-05-02

## 1. Doc lint

### `lint-requirements.mjs` against the Requirements doc

```
lint-requirements: prompt-tests/instructions-reach-e2e/output/instructions-canary/baseline-instructions-canary-2026-05-02/baseline-instructions-canary-2026-05-02-REQUIREMENTS.md
  blocks: 14  errors: 1  warnings: 0
  ERROR  frontmatter.requirement_count (12) != actual block count (14)
{"linter":"lint-requirements","source":"prompt-tests/instructions-reach-e2e/output/instructions-canary/baseline-instructions-canary-2026-05-02/baseline-instructions-canary-2026-05-02-REQUIREMENTS.md","ok":false,"errors":["frontmatter.requirement_count (12) != actual block count (14)"],"warnings":[],"blockCount":14}
```

Exit code: 1. `ok: false`.

### `lint-master-plan.mjs` against the Master Plan doc

```
lint-master-plan: prompt-tests/instructions-reach-e2e/output/instructions-canary/baseline-instructions-canary-2026-05-02/baseline-instructions-canary-2026-05-02-MASTER-PLAN.md
  phases: 1  tasks: 1  errors: 0  warnings: 0
{"linter":"lint-master-plan","source":"prompt-tests/instructions-reach-e2e/output/instructions-canary/baseline-instructions-canary-2026-05-02/baseline-instructions-canary-2026-05-02-MASTER-PLAN.md","ok":true,"errors":[],"warnings":[],"phaseCount":1,"taskCount":1}
```

Exit code: 0. `ok: true`.

## 2. Self-test

### `lint-requirements.mjs --self-test`

```
lint-requirements: <self-test>
  blocks: 3  errors: 6  warnings: 0
  ERROR  frontmatter: expected `type: requirements`, got `not_requirements`
  ERROR  FR-1: missing body description sentence under heading
  ERROR  FR-3: missing body description sentence under heading
  ERROR  frontmatter.requirement_count (5) != actual block count (3)
  ERROR  FR-1: duplicate ID
  ERROR  FR-2: gap in ID sequence (missing)
{"linter":"lint-requirements","source":"<self-test>","ok":false,"errors":["frontmatter: expected `type: requirements`, got `not_requirements`","FR-1: missing body description sentence under heading","FR-3: missing body description sentence under heading","frontmatter.requirement_count (5) != actual block count (3)","FR-1: duplicate ID","FR-2: gap in ID sequence (missing)"],"warnings":[],"blockCount":3}
```

Exit code: 0. Self-test passes (linter correctly flags the synthetic bad input).

### `lint-master-plan.mjs --self-test`

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
{"linter":"lint-master-plan","source":"<self-test>","ok":false,"errors":["frontmatter: expected `type: master_plan`, got `not_master_plan`","frontmatter.total_phases (3) != actual phase count (2)","frontmatter.total_tasks (5) != actual task count (2)","P01: missing phase description sentence under heading","P02: missing phase description sentence under heading","P02-T01: missing task description sentence under heading"],"warnings":["companion requirements doc not found alongside master plan; skipping referential integrity check"],"phaseCount":2,"taskCount":2}
```

Exit code: 0. Self-test passes (linter correctly flags the synthetic bad input).

## 3. Marker greps

All paths relative to the run folder. Counts are stdout from `grep -c <token> <file>`.

```
grep -c "MARKER-CLAUDEMD-7G3K9P" baseline-instructions-canary-2026-05-02-MASTER-PLAN.md         = 1
grep -c "MARKER-AGENTSMD-5Q8L2N" src/reverse.js                                                  = 0
grep -c "MARKER-AGENTSMD-5Q8L2N" src/__tests__/reverse.test.js                                   = 0
grep -c "MARKER-COPILOT-4R6T1J" src/reverse.js                                                   = 0
grep -c "MARKER-COPILOT-4R6T1J" src/__tests__/reverse.test.js                                    = 0
```

Bonus (not on the canonical five — the runner's reach matrix only covers the Master Plan for the CLAUDE.md marker, but the planner also emitted it during the Requirements spawn):

```
grep -c "MARKER-CLAUDEMD-7G3K9P" baseline-instructions-canary-2026-05-02-REQUIREMENTS.md        = 1
```

## 4. Summary

Doc lints: **FAIL** — `lint-requirements.mjs` reports `ok: false` because the planner's frontmatter `requirement_count: 12` does not match the actual block count of 14 (the planner authored 4 FR + 3 NFR + 4 AD + 3 DD = 14 blocks but wrote 12 in frontmatter). `lint-master-plan.mjs` is `ok: true`. Both linter self-tests are healthy. The lint failure is orthogonal to the reach matrix.
