# Review-Rework Fixtures (Iter 12)

Six fixture pairs — `clean` + `broken` per review scope (task / phase / final). Each fixture captures the minimum set of files a reviewer would need plus a driver that turns the fixture into a synthesised git repo via `helpers/git-fixture.ts`.

## Layout

```
review-rework/
  index.ts                      # Fixture registry + TypeScript declarations
  task-review/clean/            # (structural placeholder)
  task-review/broken/           # (structural placeholder)
  phase-review/clean/           # (structural placeholder)
  phase-review/broken/          # (structural placeholder)
  final-review/clean/           # (structural placeholder)
  final-review/broken/          # (structural placeholder)
```

All fixture data is authored in `index.ts` as `ReviewReworkFixture` objects. Each fixture declares:
- Commit sequence (messages + file contents to rehydrate in temp git repo).
- Planning-doc content (requirements, phase plan, task handoffs) as inlined strings.
- Expected frontmatter shape (verdict, severity, audit fields).
- Expected audit-table rows (representative sample of outcome — e.g., one drift row for broken fixtures).

## Design rationale

The fixture **drivers** live in TypeScript (`index.ts`) rather than on-disk assets so the fixtures can declare commit structure programmatically — each commit's file contents + message in a single place. This keeps the data + driver colocated and avoids parallel `.ts` and `.md` trees drifting.

Tests under `scripts/tests/review-rework-fixtures.test.ts` call `createGitFixture()` with each fixture's commit structure, derive the relevant enrichment SHAs from a synthetic state.json, and confirm:

1. The diff the reviewer would compute (`git diff <base>~1..<head>`) matches the fixture's expected change shape (sanity check on the driver).
2. A review doc with the fixture's expected frontmatter passes the pre-read validator.
3. Injecting an invalid verdict against the same frontmatter shape is rejected by the validator.

The test does NOT actually run a reviewer subagent — that lives in the prompt-harness (`prompt-tests/code-review-rework-e2e/`). These unit fixtures exercise the engine contract; the harness exercises the agent contract.
