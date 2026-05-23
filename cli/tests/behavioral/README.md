# CLI Behavioral Test Tier

## Purpose
The behavioral tier holds tests that drive CLI commands through their normal
framework dispatch and assert on the externally-observable contract — the
JSON envelope, the resulting `state.json`, and any side-files the command
touches. The tier is the home for tests that must survive internal
refactors and fail only when the public contract changes.

## Directory layout
- `cli/tests/behavioral/<command>/` — one folder per command family.
- `cli/tests/behavioral/<command>/helpers/` — helpers scoped to that
  command's suite. No CLI-wide helper module exists.
- `cli/tests/behavioral/<command>/events/<event>.behavioral.test.ts` — one
  file per legal event (default organization).
- `cli/tests/behavioral/<command>/unhappy/<class>.behavioral.test.ts` —
  unhappy-path tests grouped by class (bad-input, invalid-transition,
  missing-world).

## `.behavioral.test.ts`
Every test file in this tier ends with `.behavioral.test.ts`. The suffix is
the explicit marker distinguishing behavioral tests from framework or
integration tests, and is the signal future tooling can filter on.

## Assertion surface
Tests assert on three surfaces and only these three: the JSON envelope, the
contents (or absence) of `state.json` after the call, and the side-files
the command touches inside the project directory. Tests never assert on
mutation order, walker decisions, intermediate engine state, log output,
or console output.

## In-process invocation
Tests invoke commands by calling the handler in-process — either through
the framework dispatcher (`runCommand(<command>, { argv, env, isTTY,
stderr })` with stdout capture) or through the core function directly.
No test in this tier spawns a Node subprocess.

## Synthetic fixtures
Each test (or tight test group) authors its own minimal template, seed
state, and project scaffolding inside a per-test `os.tmpdir()` directory.
Production tier templates (`runtime-config/templates/*.yml`) are never
read by any test in this tier.

## Helper scoping
Helpers live inside each command family's own behavioral folder
(`cli/tests/behavioral/<command>/helpers/`) and are used only by that
family's tests. No CLI-wide behavioral-test helper module exists; copy
the shape into a new command's folder when adopting the tier.

## Behavioral vs framework vs integration
- Framework tests cover argv parsing, exit-code wiring, logger plumbing —
  they live in `cli/tests/framework/`.
- Integration tests cover cross-command or cross-package wiring — they
  live in `cli/tests/integration/`.
- Behavioral tests cover the public contract of a single command — they
  live here. When in doubt, prefer behavioral over integration if the
  assertion is on the envelope, state, and side-files of a single
  command call.

## Pipeline worked example
The `pipeline` command is the first adopter of the tier. See
`cli/tests/behavioral/pipeline/` for the per-event happy-path coverage,
the three unhappy-path classes (bad-input, invalid-transition,
missing-world), and the helper trio (`world.ts`, `capture.ts`,
`assert.ts`).
