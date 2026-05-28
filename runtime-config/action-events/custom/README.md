# Custom Action / Event Prompts

`~/.radorc/action-events/` holds the prompts the pipeline composes for each tick — one shipped catalog file per action or event, plus a `custom/` overlay folder where you teach the orchestrator project-specific behavior. The composer cold-reads overlay files on every envelope build, so edits take effect on the next pipeline event without restarting any service.

## How customs layer onto shipped prompts

Each tick the composer assembles a single prompt envelope for the current action. It glues together up to five sections in this order: a *before-action* overlay you provide, the shipped action body, a *before-signaling* overlay you provide, the shipped event body (with the signal line the orchestrator must emit), and an *after-signaling* overlay you provide. Three of those five sections are overlay slots — the others are the shipped catalog one folder up.

The three overlay slot files are:

1. `action.<name>.pre.md` — runs *before* the shipped action body. Use it for setup, context fetch, or pre-flight checks.
2. `event.<name>.pre.md` — runs *before* signaling completion. Use it for last-mile validation.
3. `event.<name>.post.md` — runs *after* signaling completion. Use it for side-effects: notify, log, index, save memory.

Terminal actions (whose frontmatter sets `completion_event: null`) have only slot 1; they emit no event.

## The composed envelope: `## Step N` numbering

Every section the composer admits to the envelope is wrapped under a uniform `## Step N` heading, numbered sequentially from 1 within each envelope. The shipped action body and shipped event body receive numbers too — no section is heading-less. Empty overlay slots collapse silently: the next admitted section gets the next number. The orchestrator's rule is then trivially "execute steps top to bottom, in numeric order; every step is authoritative."

Whitespace-only overlay files are treated as empty; they neither contribute a section nor consume a step number.

## Signaling that custom content is present

The pipeline success envelope's `data` block carries a boolean field `has_custom_instructions`. It is `true` iff at least one overlay slot contributed admitted content to the current envelope (or, in the orphan-event prepend case below, when the firing event's post overlay was prepended). It is `false` when only shipped catalog content was composed. The flag is the orchestrator's load-bearing primitive — when `has_custom_instructions === true`, your overlay prose is in the envelope and must be followed verbatim.

## Orphan events: post-overlays prepend to the next action

Most events are "completion events" — they belong to a single action and fire when that action finishes. Their `event.<name>.post.md` overlay is placed inside the bracketing action's envelope (Step 5 above).

A small number of events are *orphan* events — no action in the catalog claims them as its `completion_event`. They are signaled out-of-band (by you, by an ad-hoc agent decision, or by an external hook). When an orphan event fires, its `event.<name>.post.md` overlay is *prepended* to the **next** action's envelope under `## Step 1`. The next action's own sections renumber to start at `## Step 2`. This is the only place orphan-event post overlays get to run; the Instruction Editor's Preview drawer shows you exactly this shape when you preview an orphan event.

## Filename convention is the contract

The filename `custom/<kind>.<name>.<slot>.md` is the entire identity contract — kind (`action` | `event`), parent name, and slot (`pre` | `post`) are encoded in the filename. **Custom files contain no frontmatter.** The composer (and the write endpoint behind the Instruction Editor UI) rejects any custom payload that begins with a `---` fence — slot files are markdown body only.

The `<name>` segment must match an existing `action.<name>.md` or `event.<name>.md` in the parent catalog folder; renaming a catalog entry intentionally breaks the overlay so authors notice rather than silently orphaning customizations.

## Authoring guidance

Write in plain instruction prose. Keep slots single-purpose: one Slack notification, one Jira ticket, one validation check. The composer concatenates literally — there is no templating, no variable interpolation. If you need branching, write it as natural English ("If the PR is a draft, skip the Slack post; otherwise…"). Aim for fewer than 200 words per slot — the orchestrator reads every word and longer prose dilutes the instruction.

## Recipe gallery

Copyable starter recipes. Each one is a one-line intent plus the target filename plus an instruction-voice body. Drop the body into a new file at the indicated path and save.

### Slack notification on PR creation
File: `event.pr_created.post.md`
```
After signaling pr_created, POST a message to the team Slack webhook at $SLACK_WEBHOOK_URL with the PR title and URL. Use a single-line summary; do not include the diff.
```

### Jira ticket on phase review
File: `action.spawn_phase_reviewer.pre.md`
```
Before spawning the phase reviewer, create a Jira ticket in project ENG titled "Phase review: <project>/<phase>" and link it back to this run's project directory. Place the ticket key in the review handoff so the reviewer can attach findings.
```

### Doc re-index on task completion
File: `event.task_completed.post.md`
```
After signaling task_completed, run `npm run docs:reindex` to regenerate the local doc search index. If the command exits non-zero, log a warning but do not fail the task — index drift is recoverable.
```

### Memory save on project complete
File: `event.project_complete.post.md`
```
After signaling project_complete, append a one-paragraph retrospective to `~/.radorc/memory/projects.md` summarizing what worked and what surprised you. Keep it under 120 words.
```

### Pre-flight check before spawning a coder
File: `action.spawn_coder.pre.md`
```
Before spawning the coder, verify the working tree is clean (`git status --porcelain` is empty) and the current branch matches the project's expected branch. If either check fails, halt with a clear message describing the mismatch.
```

## Where customs live on disk

On install, the harness copies this folder to `~/.radorc/action-events/custom/` (creating the directory if needed). The shipped catalog one folder up (`~/.radorc/action-events/`) is upgraded in place on every install/upgrade tick; your `custom/` overlay is left untouched. Edits to overlay files on disk take effect on the next pipeline event — the composer reads them cold every tick.
