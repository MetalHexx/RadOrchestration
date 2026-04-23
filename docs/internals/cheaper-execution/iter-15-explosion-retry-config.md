# Iter 15 — Explosion-retry configurability

> **Status**: Stub. Created during Iter 5 planning when the explosion-retry cap was deferred from being baked-in to being configurable. This iteration is intentionally light on detail — the planner agent that picks this up will brainstorm the design with the user before writing the inner-session plan.
>
> **Validation Preface** (when the time comes): grep / glob the Code Surface section against live code. Iter 5 hardcoded `MAX_PARSE_RETRIES = 3` — confirm where that constant lives before designing the replacement.

## Why this exists

Iter 5 introduced the explosion script + parse-failure recovery loop. The retry cap (3) is a hardcoded constant. This iteration surfaces it as a per-installation tunable so operators can adjust based on actual planner behavior in their environment.

## Scope sketch (NOT a final scope — brainstorm with user when starting this iteration)

- New field in `orchestration.yml` schema: `explosion_max_retries: integer` (sensible default = 3, bounds TBD).
- Validator rule in `validate/lib/checks/config.js` (or wherever config validation lives — verify at plan time): bounds-check the field (e.g., `>= 0`, `<= 20`).
- Wire the value through to the `explosion_failed` mutation handler so the cap is read from config, not the hardcoded constant.
- `/configure-system` skill (verify exact location + workflow at plan time): add a prompt for the new field + persistence to `orchestration.yml`.
- `installer/index.js` interactive prompt: prompt the user during install, write the value into the project's `orchestration.yml`.
- Tests across orchestration scripts (config-read path), installer (prompt + write-through), and `/configure-system` skill (read + write).

## Open questions to resolve at brainstorm time

These are deliberately left open — they need user input before the design is locked.

1. **Where does the retry counter live in `state.json`?** Iter 5 stored `parse_retry_count` on the `master_plan` node-state shape as a provisional location. Alternatives to consider:
   - Stay on `master_plan` node (current). Pro: easy to clear when explosion succeeds. Con: pollutes the planner-node shape with explosion-loop state.
   - Move to `explode_master_plan` node-state. Pro: conceptually "this is the explosion's retry counter." Con: harder to reset cleanly when planning succeeds.
   - Move to `state.metadata` as a dedicated counter object. Pro: clean separation of concerns. Con: hidden from per-node UI views; needs explicit lifecycle.
   - Decide based on UI observability needs (does the user benefit from seeing "retry 2 of 3" in the timeline?) and on whether other future loops will need similar counters.

2. **Validator bounds for the field**:
   - Lower bound: 0 (disable recovery — fail immediately on parse error)? Or 1 (must allow at least one retry)?
   - Upper bound: 5? 10? Higher? Tradeoff between giving the planner a fair shot vs. burning tokens on a hopeless attempt.
   - What's the default if the field is absent from `orchestration.yml`? (Likely: 3, matching Iter 5's hardcoded constant.)

3. **Configurability surface coverage**:
   - Just the cap, or also things like: which file the parser reads, where backups land, whether to validate emitted-doc frontmatter? The latter is a slippery slope; recommend keeping scope tight to the cap alone unless evidence suggests otherwise.

4. **Installer prompt UX**:
   - Where in the installer flow does this prompt land? Existing prompts are in `installer/index.js` — read first to see what conventions exist.
   - Default value, prompt copy, whether it's a "yes/no/skip" with a stored default vs. always-asked.
   - Should `/configure-system` and the installer share prompt logic or have parallel implementations? Investigate at plan time.

5. **How often does the recovery loop actually fire in practice?** This iteration should land AFTER some real-world usage of Iter 5's hardcoded behavior, so we have evidence about whether 3 is the right default and whether the cap is even getting hit.

## Dependencies

- **Depends on**: Iter 5 (recovery loop exists with hardcoded cap).
- **Blocks**: Iter 17 (public-facing docs refresh) — the public docs should describe the configurable field, not the hardcoded constant.

## Discussion notes for future planner

- User's expressed concern at Iter 5 brainstorm time: the configurability piece "needs to be evaluated further." Treat this iteration as a real brainstorm — don't jump to writing a plan. Sit with the open questions above.
- The blast radius is genuine — three trees touched (engine, skill, installer). Each has its own testing surface and its own reviewer rhythm. Plan accordingly; budget for it.
- Look at how other `orchestration.yml` fields are wired through if any analog exists. Mirror the pattern rather than inventing a new one.
