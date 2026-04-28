# Pipeline Testing

How to verify pipeline engine changes. Run tests early, run them often, and never suppress a behavioral test failure.

## Test Hierarchy

For every pipeline change, follow this order:

1. **Run the full test suite for every module you touched.** Mutations changes can break resolver tests. Resolver changes can break behavioral tests. Don't run just the one test file for the file you edited.
2. **Always run both behavioral test files.** There are two.  If either breaks, that's a real integration issue — investigate it:  
- `pipeline-behavioral.test.js` tests full multi-event sequences through the engine directly (no CLI)
- `pipeline.test.js` includes E2E tests that invoke `pipeline.js` as a child process (tests the CLI surface). 
3. **Pre-existing test failures are not your scope.** If a test was already failing before your change, do not fix it inline. Signal the Tactical Planner to create a corrective task. Your change should not expand scope.

## Module → Test File Lookup

All test files are under `.claude/skills/orchestration/scripts/tests/`.

| Module | Test File | What It Covers |
|--------|-----------|----------------|
| `pipeline.js` | `pipeline.test.js` | CLI argument parsing, **behavioral**: E2E invocations via child_process |
| `lib/pipeline-engine.js` | `pipeline-engine.test.js` | `processEvent()`, state scaffolding, cold start |
| `lib/mutations.js` | `mutations.test.js` | Individual mutation handlers, MUTATIONS registry |
| `lib/resolver.js` | `resolver.test.js` | Action resolution for all tiers, gate mode handling |
| `lib/validator.js` | `validator.test.js` | All invariant checks, transition map enforcement |
| `lib/pre-reads.js` | `pre-reads.test.js` | Document frontmatter validation, enrichment |
| `lib/constants.js` | `constants.test.js` | Enum values, transition map completeness |
| `lib/state-io.js` | `state-io.test.js` | State read/write, path resolution |
| *(cross-cutting)* | `pipeline-behavioral.test.js` | **Behavioral**: full multi-event sequences without CLI — happy path, corrective cycles, gate modes |
| *(cross-cutting)* | `gate-behavior.test.js` | Gate mode transitions, retry budgets across task/phase |
| *(cross-cutting)* | `gate-mode-schema.test.js` | Gate mode schema validation |
| *(cross-cutting)* | `corrective-cycle.test.js` | Corrective task workflow, failure recovery, retry handling |
| *(cross-cutting)* | `migration.test.js` | State migration (relevant when changing schema) |

## Running Tests

Tests use Node's built-in `node:test` runner. No npm install required.

```bash
# Run a single test file
node --test .claude/skills/orchestration/scripts/tests/mutations.test.js

# Run all pipeline tests
node --test .claude/skills/orchestration/scripts/tests/*.test.js

# Run behavioral tests (both files)
node --test .claude/skills/orchestration/scripts/tests/pipeline-behavioral.test.js
node --test .claude/skills/orchestration/scripts/tests/pipeline.test.js
```

## Test Infrastructure

All tests use dependency injection via `MockIO` — no filesystem in unit tests.

| Helper | Import From | Purpose |
|--------|-------------|---------|
| `createMockIO()` | `tests/helpers/test-helpers.js` | In-memory I/O with deep-cloned state/config reads |
| `createBaseState()` | `tests/helpers/test-helpers.js` | Minimal valid v4 state (planning tier) |
| `createExecutionState()` | `tests/helpers/test-helpers.js` | State with execution tier active, phases/tasks set up |
| `createReviewState()` | `tests/helpers/test-helpers.js` | State in review tier |
| `createDefaultConfig()` | `tests/helpers/test-helpers.js` | Default orchestration.yml config object |
| `processAndAssert()` | `tests/helpers/test-helpers.js` | Run `processEvent()` with MockIO and assert the result |
| `deepClone()` | `tests/helpers/test-helpers.js` | Safe clone to prevent test data pollution |

When writing new tests:
- Use `createMockIO()` — never hit the filesystem
- Use state factories — never handcraft full state objects
- Deep clone any state you reuse across test cases
- Follow the existing `describe()` / `it()` / `test()` structure in neighboring test files
