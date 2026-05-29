# Customize Action / Event Prompts

Rad Orchestration drives every project forward by composing a fresh instruction prompt for the orchestrator agent at each pipeline tick. These prompts come from the `action-*.md` and `event-*.md` catalog files in this folder — the *shipped catalog*. You can extend any prompt with your own instructions by dropping markdown files into the `custom/` subfolder. The orchestrator reads those overlays on every tick and follows them verbatim alongside the shipped prose.

This lets you teach the orchestrator project-specific behavior — post to Slack when a PR opens, run a doctor check before spawning a coder, write a memory file when the project completes — without modifying any shipped file or running custom code.

## How customization works

Every pipeline tick is anchored on an **action** (something the orchestrator does) and, when that action finishes, an **event** (a signal the orchestrator emits to mark progress). You can layer up to three overlay slots around that pair:

- **Before the action runs** — setup, context gathering, pre-flight validation.
- **Before signaling the event** — last-mile checks, gating decisions.
- **After signaling the event** — side-effects: notifications, logging, indexing, saving memory.

Each overlay is a plain markdown file in `custom/` whose filename names exactly one slot:

| Filename pattern | When it runs |
|---|---|
| `action.<name>.pre.md` | Before the orchestrator executes the named action |
| `event.<name>.pre.md` | Before the orchestrator signals the named event |
| `event.<name>.post.md` | After the orchestrator signals the named event |

`<name>` matches the shipped catalog file's name — for instance, `action.execute_task.pre.md` extends the `execute_task` action, and `event.pr_created.post.md` extends the `pr_created` event. Browse this folder to see every available `<name>`; rename safety is built in (changing a shipped name intentionally orphans the overlay so you notice).

Write overlay prose in plain English, addressed to the orchestrator. There's no templating and no scripting — if you need branching, describe it as natural prose ("If the PR is a draft, skip the Slack post; otherwise…"). Aim for fewer than 200 words per slot; the orchestrator reads every word.

## Use cases

These are starter recipes — drop each body into a file at the named path.

### Slack notification when a PR is created
File: `custom/event.pr_created.post.md`

```
After signaling pr_created, POST a message to the team Slack webhook at $SLACK_WEBHOOK_URL with the PR title and URL. Use a single-line summary; do not include the diff.
```

### Jira ticket before a phase review
File: `custom/action.spawn_phase_reviewer.pre.md`

```
Before spawning the phase reviewer, create a Jira ticket in project ENG titled "Phase review: <project>/<phase>" and link it back to this run's project directory. Place the ticket key in the review handoff so the reviewer can attach findings.
```

### Doc re-index when a task completes
File: `custom/event.task_completed.post.md`

```
After signaling task_completed, run `npm run docs:reindex` to regenerate the local doc search index. If the command exits non-zero, log a warning but do not fail the task — index drift is recoverable.
```

### Pre-flight check before spawning a coder
File: `custom/action.execute_task.pre.md`

```
Before executing the task, verify the working tree is clean (`git status --porcelain` is empty) and the current branch matches the project's expected branch. If either check fails, halt with a clear message describing the mismatch.
```

### Save a project retrospective when work finishes
File: `custom/event.final_approved.post.md`

```
After signaling final_approved, append a one-paragraph retrospective to ~/.radorc/memory/projects.md summarizing what worked and what surprised you. Keep it under 120 words.
```

## Your overlays are preserved across upgrades

The `custom/` subfolder is sacred. When you install a new version of Rad Orchestration, or reinstall over an existing setup, the installer leaves every file in `custom/` exactly as you wrote it — overlays are never overwritten, never replaced, never removed. The same protection applies if you uninstall and reinstall: nothing in `custom/` is touched by Rad-managed lifecycle operations.

This README itself lives one folder up (`action-events/README.md`, not in `custom/`) because the help text *does* refresh on upgrade — improvements to this prose reach you the next time you install. Your overlays do not.

## Editing live

Edits take effect on the next pipeline event — there is no service to restart, no cache to clear. Save the file and the next tick picks it up.
