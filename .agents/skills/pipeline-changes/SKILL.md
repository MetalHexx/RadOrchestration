---
name: pipeline-changes
description: 'Domain knowledge for modifying the orchestration pipeline engine. Use when changing pipeline-engine.js, mutations.js, resolver.js, validator.js, pre-reads.js, constants.js, state-io.js, or when adding fields to orchestration.yml or state.json. Covers change patterns, schema/UI update checklists, testing strategy, and documentation requirements for safe pipeline modifications.'
---

# Pipeline Changes

Development skill for modifying pipeline engine code. Provides architecture context, change patterns, testing strategy, and documentation requirements.

**Scope:** Pipeline engine modules only — `pipeline-engine.js`, `mutations.js`, `resolver.js`, `validator.js`, `pre-reads.js`, `constants.js`, `state-io.js`, and `pipeline.js` (CLI entry point). Does not cover the installer, dashboard UI, or validation CLI.

**Prerequisite:** For baseline system context (agent roles, tier flow, event vocabulary, action routing), read the rad-orchestration skill's [references/context.md](../../../.claude/skills/rad-orchestration/references/context.md).

## Invariants

These are non-negotiable for every pipeline change:

### Coders and Reviewers:
- **Run the full test suite** for every module you touched — mutations changes can break resolver tests.
- **Always run both behavioral test files** — `pipeline-behavioral.test.js` (full event sequences without CLI) and `pipeline.test.js` (E2E via child_process, tests the CLI surface). These are the integration safety net.
- **Pre-existing test failures are not your problem** — if a test was already broken, signal the Tactical Planner to create a corrective task. Do not expand scope.

### Coders:
- **Follow established patterns** — if your change requires deviating from documented patterns and this isn't part of your explicit task, escalate to the Tactical Planner. This is a red flag.
- **Update pipeline documentation** — or signal the Tactical Planner to create a documentation task if the update is substantial.

### Tactical Planner:
 - Create tasks to update this skill if we need to make significant changes to the pipeline.

## Reference Documents

Read the reference doc(s) that match your work before making changes.

| Role | Reference | What It Provides |
|------|-----------|------------------|
| All | [pipeline-internals.md](references/pipeline-internals.md) | Module map, runtime data flow, stage lifecycles |
| Coder, Planner | [pipeline-patterns.md](references/pipeline-patterns.md) | Change checklists, inline gotchas, red flags |
| Coder, Reviewer | [pipeline-testing.md](references/pipeline-testing.md) | Test strategy, module→test lookup, infrastructure |
| Coder, Planner | [pipeline-schema-ui.md](references/pipeline-schema-ui.md) | File checklists for config/state field additions |
| All | [pipeline-documentation.md](references/pipeline-documentation.md) | Doc update matrix, escalation triggers |

## Contents

This skill bundles:

- **`references/pipeline-internals.md`** — Module dependency graph, runtime data flow, task and phase stage lifecycles
- **`references/pipeline-patterns.md`** — Decision table for common changes, inline gotchas per pattern, red flags for pattern deviations
- **`references/pipeline-testing.md`** — Test hierarchy, module-to-test lookup, MockIO pattern, behavioral test expectations
- **`references/pipeline-schema-ui.md`** — Step-by-step checklists for adding config fields (orchestration.yml → UI) and state fields (state.json → schema → types)
- **`references/pipeline-documentation.md`** — Documentation update matrix, escalation rules, self-update triggers
