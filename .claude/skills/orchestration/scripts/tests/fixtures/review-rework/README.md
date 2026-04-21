# Review-Rework Fixtures (Iter 12)

Six fixture pairs — `clean` + `broken` per review scope (task / phase / final). Each fixture captures the minimum set of files a reviewer would need plus a driver that turns the fixture into a synthesised git repo via `helpers/git-fixture.ts`.

## Layout

```
review-rework/
  index.ts                      # Shared driver + fixture registry
  task-review/
    clean/                      # Diff satisfies FR-1 + FR-2; expect verdict: approved, all rows on-track
    broken/                     # Diff regresses FR-2; expect verdict: changes_requested with one drift finding
  phase-review/
    clean/                      # Cumulative 2-task diff satisfies both requirements; expect verdict: approved
    broken/                     # T1 returns X, T2 consumes Y — cross-task contract drift; expect verdict: changes_requested with drift
  final-review/
    clean/                      # Cumulative branch diff fully satisfies every FR/NFR; expect verdict: approved, all rows met
    broken/                     # Cumulative diff misses NFR-2 entirely; expect verdict: changes_requested with missing
```

Each fixture folder carries:

- `{NAME}-REQUIREMENTS.md` — FR/NFR ledger inlined by the fixture driver.
- Phase / final fixtures also carry `{NAME}-MASTER-PLAN.md` and `{NAME}-PHASE-01-{TITLE}.md` plus task handoffs.
- Source file snapshots (content strings) rehydrated into temp-repo commits by the driver.
- `expected.json` — the fixture's expected verdict + representative audit-table rows, consumed by the test to assert correctness.

## Design rationale

The fixture **drivers** live in TypeScript (`index.ts`) rather than on-disk assets so the fixtures can declare commit structure programmatically — each commit's file contents + message in a single place. This keeps the data + driver colocated and avoids parallel `.ts` and `.md` trees drifting.

Tests under `scripts/tests/review-rework-fixtures.test.ts` call `createGitFixture()` with each fixture's commit structure, derive the relevant enrichment SHAs from a synthetic state.json, and confirm:

1. The diff the reviewer would compute (`git diff <base>~1..<head>`) matches the fixture's expected change shape (sanity check on the driver).
2. A review doc with the fixture's expected frontmatter passes the pre-read validator.
3. Injecting an invalid verdict against the same frontmatter shape is rejected by the validator.

The test does NOT actually run a reviewer subagent — that lives in the prompt-harness (`prompt-tests/code-review-rework-e2e/`). These unit fixtures exercise the engine contract; the harness exercises the agent contract.
