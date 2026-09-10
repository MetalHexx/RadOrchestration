# Sessions

A conversation with an agent doesn't end when you close the terminal — the project it was working
on remembers it. Every session that touches a project becomes part of that project's **journey**,
and you can step back into any point along it, or simply pick up where you left off.

## What a session is

A **session** is one harness conversation — one Claude Code or Copilot run, start to finish. Its
**activity trail** is an append-only record of what happened during it: an entry for the moment you
agreed on requirements, another for a plan being authored, another for a phase executing, another
for a corrective coming back from review. A session that touches a project more than once picks up
another entry each time; the trail only ever grows.

The sessions attributed to a project, together, are its **journey**.

## What gets recorded, and when

Two things write to a project's journey, and neither asks you to set anything up first.

**The pipeline records at its own seams.** `/rad-brainstorm`, `/rad-plan`, `/rad-execute`,
`/rad-amend`, and the final approval gate each save an activity entry the moment they reach a point
worth remembering. You don't do anything for this to happen — it rides along with the run.

| Activity | Recorded when |
|---|---|
| Requirements | Brainstorming converges and `/rad-brainstorm` hands off into writing the requirements document |
| Master Plan | `/rad-plan` is about to author the plan |
| Execution | `/rad-execute` starts or resumes driving a run |
| Amend | `/rad-amend` authors a revision to an already-approved plan |
| Execution complete | The run finishes every phase and task and reaches the final approval gate |
| Final approved / Final rejected | Your answer at that gate |
| Halted | The pipeline stops on something only you can resolve |
| Corrective | You ask for changes at final review and it's routed as a quick fix rather than a new plan |
| Brainstorming, Other | Whatever `/rad-session` infers when you ask it to save manually, or can't infer at all |

**`/rad-session` records on request.** Say "save this session," "save my progress," or anything
like it, and the current conversation gets an activity entry against whichever project you name —
or the one you're standing in, if you don't say. The first save against a project asks you to
confirm a name; every later save in the same conversation just appends. It's the same skill behind
resuming ("pick up where I left off," "resume my session") and listing ("what was I working on?")
— say the words, no slash command required.

## The Overview page

Open any project and its Overview shows two things: the documents it's produced, and its
**Session Journey** — every session that's touched it, newest first, and inside each one, its
activity trail newest first too. Every session collapses to a header-only row — chevron, name,
and activity count; expand it to see the full activity list.

Two buttons ride along with every session:

- **Continue Session** reopens a terminal at the recorded launch directory, resuming that exact
  conversation.
- **View Telemetry** jumps to that session's numbers in Observability — its transcript, its tool
  calls, and what it spent.

If a project shows no sessions yet, the section says so and points you at `/rad-session` rather
than hiding — most projects driven through the pipeline will already have entries by the time you
look.

## Good to know

**Sessions eventually disappear.** The harness prunes its own conversation history on its own
schedule, independent of anything Rad Orc does. A session recorded here can easily outlive the
conversation it points at — the record itself doesn't expire, but the conversation behind it can
be long gone. When that happens, **Continue Session still opens a terminal** — there's no way to
know in advance whether a resume will succeed — and the resume fails inside it. That's the honest
shape of it: a stale entry doesn't hide itself, because a silent failure would be far more
confusing than a terminal telling you plainly that the conversation is gone.

**Active time is derived, never stored.** The active-time figure next to each session, and the
total at the top of the journey, is computed from telemetry usage rows the moment you look — it
isn't a number written down anywhere. See [Observability](observability.md) for what else lives
there: the full transcript, every tool call, and what it cost.

**Copilot CLI resumes, but reports no active time.** `Continue Session` works the same way it does
for Claude Code, but Copilot CLI captures no telemetry today, so there's nothing to show under
**View Telemetry** and no active time to add to the total.

**Copilot in VS Code isn't part of the journey at all.** There's no CLI resume path for a VS Code
session to reopen into, so nothing about one gets saved, listed, or continued.

---

> Contributing to Rad Orc? How the two on-disk stores fit together, where the capture seams live,
> and why some things were deliberately left out is covered in
> [Session Tracking Internals](internals/session-tracking.md).

---

**Read Next:** [Projects](projects.md) · [Dashboard](dashboard.md) ·
[Observability](observability.md) · [Ambient Awareness](ambient-awareness.md) ·
[Docs Viewer](docs-viewer.md)
