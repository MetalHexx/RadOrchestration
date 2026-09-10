<!--
Reviewers read this before the diff. Keep it high level — what changed and why,
not a walkthrough of the implementation.

If you built this with the Rad Orc pipeline, the PR report it produced already
covers this. Paste it in place of the sections below.

See the README, or the issue tracker for background:
https://github.com/MetalHexx/RadOrchestration/issues
-->

## What this changes

<!-- One or two sentences, in plain terms. -->

## Why

<!-- The problem being solved. Link the issue if there is one. -->

## Modules touched

<!-- One line per module: what changed in it and why. -->

-

## Distribution impact

<!--
Does this add, rename, move, or delete any file the installers ship? Does it
change a manifest catalog, or anything under harness-installers/shared/build-helpers/?

"None" is a fine answer — say it explicitly. If you aren't sure, say that instead
and ask in the PR.
-->

## How it was tested

<!-- Which harnesses, which builds, which suites. -->

---

### Pre-land gates

CI does not cover these. Tick what you ran, and what you confirmed.

- [ ] Every installer build exits 0 — see [`AGENTS.md` → Pre-land validation gates](../AGENTS.md#pre-land-validation-gates)
- [ ] `/rad-dogfood-harness` on every harness this change affects
- [ ] `/rad-dogfood-plugin`, per plugin variant, if this changes how a plugin is packaged or installed
- [ ] `npm test -w ui`, for any `ui/` change — CI runs only `next build` and one smoke route
- [ ] `node --test harness-files/tests/*.test.mjs`, for any canonical-source change
- [ ] `docs/` updated, if user-visible behavior changed
- [ ] `docs/internals/` and the relevant module `AGENTS.md` updated, if structure changed
- [ ] No `version` field or `@rad-orchestration/*` dependency spec was bumped
- [ ] No `Co-authored-by:` trailer naming an AI model, and no "Generated with" line, in any commit
      or in this PR body
