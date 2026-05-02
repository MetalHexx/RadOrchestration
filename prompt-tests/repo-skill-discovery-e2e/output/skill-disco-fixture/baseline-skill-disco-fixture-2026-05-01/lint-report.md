# Lint Report — baseline-skill-disco-fixture-2026-05-01

## Doc lint — Requirements

```
lint-requirements: prompt-tests/repo-skill-discovery-e2e/output/skill-disco-fixture/baseline-skill-disco-fixture-2026-05-01/baseline-skill-disco-fixture-2026-05-01-REQUIREMENTS.md
  blocks: 29  errors: 0  warnings: 0
{"linter":"lint-requirements","source":"prompt-tests/repo-skill-discovery-e2e/output/skill-disco-fixture/baseline-skill-disco-fixture-2026-05-01/baseline-skill-disco-fixture-2026-05-01-REQUIREMENTS.md","ok":true,"errors":[],"warnings":[],"blockCount":29}
```

## Doc lint — Master Plan

```
lint-master-plan: prompt-tests/repo-skill-discovery-e2e/output/skill-disco-fixture/baseline-skill-disco-fixture-2026-05-01/baseline-skill-disco-fixture-2026-05-01-MASTER-PLAN.md
  phases: 4  tasks: 16  errors: 0  warnings: 0
{"linter":"lint-master-plan","source":"prompt-tests/repo-skill-discovery-e2e/output/skill-disco-fixture/baseline-skill-disco-fixture-2026-05-01/baseline-skill-disco-fixture-2026-05-01-MASTER-PLAN.md","ok":true,"errors":[],"warnings":[],"phaseCount":4,"taskCount":16}
```

## Self-test — lint-requirements

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

Self-test surfaced its expected six errors and exited non-zero — linter is functioning correctly.

## Self-test — lint-master-plan

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

Self-test surfaced its expected six errors plus the companion-doc warning — linter is functioning correctly.

## Summary

Both production lints passed (`ok: true`, zero errors, zero warnings) and both self-tests surfaced their expected error sets. **Doc-lint layer is green.**
