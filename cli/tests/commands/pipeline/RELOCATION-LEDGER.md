# SCRIPT-FOLD-4 — Test Relocation Ledger

| Legacy file | Verdict | Destination | Rationale |
|-------------|---------|-------------|-----------|
| `harness-files/skills/rad-orchestration/scripts/lib/__tests__/pipeline.test.js` | retain | (stays) | Asserts that the legacy `pipeline.js` bundle artifact exists on disk; specific to the legacy build-pipeline ceremony that retires in iter 5. Does not exercise engine logic. |
| `harness-files/skills/rad-orchestration/scripts/tests/pipeline-path-resolver.test.ts` | relocate (adapted) | `cli/tests/lib/pipeline/path-context.test.ts` (already authored in P01-T03) | Behavior is the path-context resolver; the iter-4 test in P01-T03 supersedes it, expressed against the new helper. |
| `harness-files/skills/rad-orchestration/scripts/tests/context-enrichment-skills-block.test.ts` | relocate | `cli/tests/lib/pipeline/context-enrichment.test.ts` | Exercises `enrichActionContext` for the `spawn_requirements` skills block; engine-internal behavior the new engine still produces. |
| `harness-files/skills/rad-orchestration/scripts/tests/fixtures/parity-states.ts` | relocate (helper) | `cli/tests/lib/pipeline/fixtures/parity-states.ts` | Shared bring-up fixture invoked by the relocated context-enrichment test and by future engine-state tests. |
| `harness-files/skills/rad-orchestration/scripts/tests/fixtures/review-rework/index.ts` | relocate (helper) | `cli/tests/lib/pipeline/fixtures/review-rework/index.ts` | Companion to `parity-states.ts`; co-imported by review-cycle assertions. |
| `harness-files/skills/rad-orchestration/scripts/tests/helpers/git-fixture.ts` | relocate (helper) | `cli/tests/lib/pipeline/helpers/git-fixture.ts` | Git-state helper used by source-control-init bring-up paths inside the relocated fixture. |

All legacy files remain in place under the harness-files tree during the coexistence window; iteration 5 removes them when the legacy pipeline artifact is retired. The destinations under `cli/tests/lib/pipeline/` are created in P04-T02 with adapted test bodies that match the new engine's interfaces.
