# action-events/custom — the operator overlay

Drop files here to extend the shipped action/event catalog without modifying the versioned entries one folder up. The composer cold-reads custom files on every envelope build, so edits take effect on the next pipeline event — no service restart is needed.

## 1. What customs do

Each custom file is a slot of pure instruction prose the orchestrator concatenates with the shipped catalog body at envelope-build time. Customs let you teach your local agents project-specific behavior (notify Slack, open a Jira ticket, re-index docs, run a pre-flight check) without forking the shipped catalog. The shipped catalog stays portable; your customs travel with your machine.

## 2. The three slots

Three slot shapes are recognized, fired in the exact order below:

1. **`action.<name>.pre.md`** — prepended before the shipped action body. Use it to tell the agent what to do *before* it performs the action (set up, fetch context, pre-flight check).
2. **`event.<name>.pre.md`** — prepended before the shipped event body. Use it for instructions the agent should follow *immediately before signaling completion* (validate, double-check the receipt).
3. **`event.<name>.post.md`** — appended after the shipped event body. Use it for *side-effects after the signal* (notify, log, index, save memory).

Terminal actions (whose frontmatter sets `completion_event: null`) have only slot 1; they emit no event.

## 3. Filename convention is the contract

The filename `custom/<kind>.<name>.<slot>.md` is the entire identity contract — kind, parent name, and slot are encoded in the filename. **Custom files contain no frontmatter.** The composer (and the write endpoint behind the Instruction Editor UI) rejects any custom payload that begins with a `---` fence — slot files are markdown body only.

The `<name>` segment must match an existing `action.<name>.md` or `event.<name>.md` in the parent catalog folder; renaming a catalog entry intentionally breaks the overlay so authors notice rather than silently orphaning customizations.

## 4. What changes vs. what doesn't

Customs change the **prose** the agent sees. Customs do **not** change the pipeline graph, signal payload contracts, or which events fire — those are catalog-level concerns. If you need a new action or event, edit the shipped catalog (`action.<name>.md` or `event.<name>.md`), not this folder.

## 5. Use-case gallery

Five copyable starter recipes. Each one is a one-line intent + the target filename + an instruction-voice body. Drop the body into a new file at the indicated path and save.

### 5.1 Slack notification on PR creation
File: `event.pr_created.post.md`
```
After signaling pr_created, POST a message to the team Slack webhook at $SLACK_WEBHOOK_URL with the PR title and URL. Use a single-line summary; do not include the diff.
```

### 5.2 Jira ticket on phase review
File: `action.spawn_phase_reviewer.pre.md`
```
Before spawning the phase reviewer, create a Jira ticket in project ENG titled "Phase review: <project>/<phase>" and link it back to this run's project directory. Place the ticket key in the review handoff so the reviewer can attach findings.
```

### 5.3 Doc re-index on task completion
File: `event.task_completed.post.md`
```
After signaling task_completed, run `npm run docs:reindex` to regenerate the local doc search index. If the command exits non-zero, log a warning but do not fail the task — index drift is recoverable.
```

### 5.4 Memory save on plan approval
File: `event.plan_approved.post.md`
```
After signaling plan_approved, append a one-paragraph summary of the approved plan to ~/.radorc/memory/approved-plans.md. Include project name, date, total phases, and a one-sentence purpose.
```

### 5.5 Pre-flight check before task execution
File: `action.execute_task.pre.md`
```
Before executing the task, confirm: (1) the working tree has no uncommitted changes outside the project directory, (2) `npm test` passes on the current branch, (3) the task's referenced files all exist. Abort with a clear error if any check fails.
```

## 6. Authoring guidance

Write slot bodies in **instruction voice** — tell the agent what to *do*, not what the action *is*. The shipped catalog already describes the action; your custom should add the project-specific behavior you want layered on top. Keep recipes short (typically 1–6 lines); long prose dilutes signal.

## 7. Where customs live on disk

During development the canonical source is `runtime-config/action-events/custom/` in this repository. After install, the same files live at `~/.radorc/action-events/custom/`. The install pipeline copies new and updated entries on every install/upgrade run; uninstalled customs persist across upgrades.
