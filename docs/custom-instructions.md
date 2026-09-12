# Custom Instructions

The orchestrator will do what you ask mid-run — [tell it once](pipeline.md#putting-it-to-work) and it
carries the instruction through the rest of the run. A custom instruction is that, made permanent.

**Custom instructions are your own prose, attached to one step of the pipeline, which the
orchestrator follows on every run — whether you're watching or not.** Run your team's regression
suite before a task can count as done. Get a Slack message when a review sends work back. Open a
Jira ticket when the project closes. There's nothing to script and no plugin to write: you're adding
sentences to instructions the orchestrator is already reading.

## Five slots, three of them yours

Every step of a run is an **action** — something the orchestrator does — followed by an **event**,
the signal that puts it on the record. See
[What's driving the run](pipeline.md#whats-driving-the-run). The instruction for that step is
composed fresh each time, out of five slots:

```
1. Before doing this action    ← yours
2. Action                        shipped
3. Before signaling            ← yours
4. When complete                 shipped
5. After signaling             ← yours
```

Two and four are the product's — the instruction for the work itself, and for recording the result.
One, three and five are empty until you write in them, and what you write is *added* to the shipped
prose rather than replacing it.

That's the whole model, and it explains why there's no sixth slot for *after the action*: the action
finishing is what produces the event, so "after the action" is already slot three. Something you want
done once the work is finished but before it counts as done goes in *before signaling*; once it's on
the record, *after signaling*. (Two actions only print a closing message and have no event at all, so
they offer slot one alone. For *when the project finishes*, reach for `final_approved` instead.)

The orchestrator is told when a step's instruction carries your prose, and told to treat it as
something that may override the normal flow — so what you write here has real weight. Keep it to what
you'd genuinely want done every time.

### Events that stand on their own

Most events belong to an action. Some don't: `start` fires at the top of a run, and `plan_rejected`,
`final_rejected` and `halt` fire when things go sideways. The editor groups these as **orphan
events** — the name only means no action claims them.

These offer *after signaling* alone. There's no single agent whose work leads up to them, so a
*before signaling* slot would have nobody to address. The after-signaling prose still runs; it
arrives at the top of the next step's instruction.

## Writing one in the Instruction Editor

The dashboard's **Instruction Editor** is the route worth learning first. It lists every action and
event down the left, grouped and filterable, with a badge on the ones already carrying your
instructions. Pick one and the five slots come up as cards in order — the shipped prose readable but
fixed, yours as an empty box with a Save button. The `?` opens the full reference in place.

The reason to start here is **Preview**: a byte-for-byte rendering of the instruction the orchestrator
would receive, your unsaved draft included. You are editing the prompt that drives the thing writing
your code, and reading the result before a run does is the difference between confidence and hoping.

It also costs no tokens. See [Dashboard](dashboard.md).

## What to write

Plain English, addressed to the orchestrator. There's no templating and no scripting — describe
branching as prose, *"if the pull request is a draft, skip the Slack post."* Aim under 200 words per
slot; every word is read on every run.

**Run your team's regression suite before a task counts as done** — `task_completed`,
*before signaling*

```
Before signaling task_completed, check whether the repo has a UI regression suite — an `e2e` or
`regression` script in package.json. If it does, run it, and halt with the failing specs if it
doesn't pass. If the repo has no such script, carry on without comment.
```

**Tell me when a review sends work back** — `code_review_completed`, *after signaling*

```
After signaling code_review_completed, if the review's verdict is changes_requested, post the task
number and the reviewer's summary line to the team Slack webhook at $SLACK_WEBHOOK_URL. Say nothing
on approved.
```

**Security scan once the final review lands** — `final_review_completed`, *after signaling*

```
After signaling final_review_completed, run ./scripts/security-scan.sh across every repo this
project touched. Write its output to SECURITY-SCAN.md in the project folder and tell me the count of
high-severity findings. Don't halt on findings — I'll decide.
```

**Check for documentation drift when the project completes** — `final_approved`, *after signaling*

```
After signaling final_approved, compare the repo's README and docs/ against what this project
changed. List any page that now describes old behavior, and the section of it that's wrong. Don't
edit anything — just give me the list.
```

**File a ticket when the project completes** — `final_approved`, *after signaling*

```
After signaling final_approved, create a Jira issue in project AIOPS titled "Review <project>",
with the PR link and the final review's verdict in the description, and transition it to Reviewing.
```

Those last two show two things about placement. **A slot is one file**, so instructions for the same
moment live together — both of them go in the same place, one after the other. And **an instruction
attaches to one entry**, so *every* review means writing the Slack one three times: task, phase and
final reviews are three separate events. See
[When a review asks for changes](pipeline.md#when-a-review-asks-for-changes) for the verdicts they
share.

None of the five uses *before doing this action*, which is the slot for what a step needs before it
starts rather than a reaction to what it did — *before opening the pull request, scan the diff for
secrets and halt if you find any* is one of those.

## Or write the file yourself

Instructions are markdown files in `~/.radorc/action-events/custom/`, one per slot, named for the
slot they fill:

| Filename | Slot |
|---|---|
| `action.<name>.pre.md` | Before doing that action |
| `event.<name>.pre.md` | Before signaling that event |
| `event.<name>.post.md` | After signaling that event |

`<name>` is the catalog entry's own name — the names the editor lists, and the names of the shipped
files one folder up.

> **A misnamed file does nothing, and nothing tells you.** The engine builds the three filenames it
> expects for the step it's on and reads exactly those. A typo, a slot that isn't one of the three, or
> a file for an entry that no longer exists is never read and never mentioned.
> `action.execute_task.post.md` is the one most people write first — there is no such slot; *after the
> action* is `event.task_completed.pre.md`. Picking the entry from a list in the editor avoids the
> whole class of problem.

Either route, edits land on the next step — nothing to restart and no cache to clear. A run already
in flight picks your change up at its next step, which is a deliberate difference from the review
tier: that gets copied into the project when you plan and frozen there, while instructions are read
live.

## Your instructions survive upgrades

The `custom/` folder is left alone by everything Rad Orc does to itself. Install a new version over
an existing setup and your files are exactly as you wrote them — never overwritten, never replaced,
never removed. Uninstalling doesn't take them either.

The shipped reference one folder up *does* refresh on upgrade, which is why it lives there and not in
`custom/`.

---

**Read Next:** [Execution Pipeline](pipeline.md) · [Dashboard](dashboard.md) ·
[Skills](skills.md) · [Configuration](configuration.md) · [Docs Viewer](docs-viewer.md)
