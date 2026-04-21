# execute-coding-task-e2e

Prompt-harness regression for the `execute-coding-task` skill introduced in Iter 13. Drives a single coder session against a pre-seeded fixture (not a full pipeline) and verifies the executor's contract: handoff-only input, mandatory 4-step RED-GREEN for `code` tasks, File Targets discipline, deliberate Execution Notes on ambiguity / out-of-scope temptation / anti-pattern carve-out, pre-report self-review, and uniform handling of original vs corrective (C1) handoffs for the same task. Shape mirrors `prompt-tests/corrective-mediation-e2e/` — the fixture ships pre-authored plan + phase + two handoff docs (original + C1) + a minimal source tree; the runner drives the executor back-to-back over both handoffs and validates the resulting artifacts against shape-based pass criteria.

## Fixture

| Fixture | Shape |
|---------|-------|
| `tdd-slip` | Tiny string-utility library — `capitalize` in the original handoff, `sentenceCase` in the C1 corrective. Each handoff carries one deliberately ambiguous step, one step that tempts an out-of-scope edit (`src/utils.js` outside File Targets), and one step prescribing a test-only method shape to exercise the anti-pattern carve-out. The C1 corrective handoff is pre-authored with an identical shape so original and corrective hit the same execution path. |
