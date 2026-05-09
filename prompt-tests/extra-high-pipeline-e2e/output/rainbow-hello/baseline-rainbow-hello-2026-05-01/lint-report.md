# Lint Report — baseline-rainbow-hello-2026-05-01

## lint-requirements (REQUIREMENTS.md)

```
lint-requirements: prompt-tests/plan-pipeline-e2e/output/rainbow-hello/baseline-rainbow-hello-2026-05-01/baseline-rainbow-hello-2026-05-01-REQUIREMENTS.md
  blocks: 23  errors: 0  warnings: 0
{"linter":"lint-requirements","source":"prompt-tests/plan-pipeline-e2e/output/rainbow-hello/baseline-rainbow-hello-2026-05-01/baseline-rainbow-hello-2026-05-01-REQUIREMENTS.md","ok":true,"errors":[],"warnings":[],"blockCount":23}
```

Exit code: 0

## lint-master-plan (MASTER-PLAN.md)

```
lint-master-plan: prompt-tests/plan-pipeline-e2e/output/rainbow-hello/baseline-rainbow-hello-2026-05-01/baseline-rainbow-hello-2026-05-01-MASTER-PLAN.md
  phases: 4  tasks: 9  errors: 0  warnings: 0
{"linter":"lint-master-plan","source":"prompt-tests/plan-pipeline-e2e/output/rainbow-hello/baseline-rainbow-hello-2026-05-01/baseline-rainbow-hello-2026-05-01-MASTER-PLAN.md","ok":true,"errors":[],"warnings":[],"phaseCount":4,"taskCount":9}
```

Exit code: 0

## lint-requirements --self-test

```
lint-requirements: <self-test>
  blocks: 3  errors: 6  warnings: 0
  ERROR  frontmatter: expected `type: requirements`, got `not_requirements`
  ERROR  FR-1: missing body description sentence under heading
  ERROR  FR-3: missing body description sentence under heading
  ERROR  frontmatter.requirement_count (5) != actual block count (3)
  ERROR  FR-1: duplicate ID
  ERROR  FR-2: gap in ID sequence (missing)
{"linter":"lint-requirements","source":"<self-test>","ok":false,"errors":[...],"warnings":[],"blockCount":3}
```

Exit code: 0 (self-test surfaces expected errors and asserts presence; exit-0 means the self-test passed)

## lint-master-plan --self-test

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
{"linter":"lint-master-plan","source":"<self-test>","ok":false,"errors":[...],"warnings":[...],"phaseCount":2,"taskCount":2}
```

Exit code: 0 (self-test surfaces expected errors and asserts presence; exit-0 means the self-test passed)

## Overall

PASS — both doc linters report `ok: true` with zero errors, both linter self-tests exit 0 confirming their assertion harness is intact. Pipeline reached `request_plan_approval` cleanly with no stale skill-path failures.
