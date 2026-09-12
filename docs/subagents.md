# Subagents

Rad Orc ships five agents. The orchestrator driving your run spawns them one at a time, hands each
one document, and collects what comes back. You don't call them yourself — there's no `@coder` you
type.

## The roster

| Agent | Model | What it does |
|---|---|---|
| `coder-junior` | Haiku | one task, end to end, from a Task Handoff |
| `coder` | Sonnet | the same job on standard and complex tasks |
| `coder-senior` | Opus | the same job again, but only on a corrective that's running out of attempts |
| `reviewer-junior` | Haiku | task-scope review of a `simple` task |
| `reviewer` | Sonnet | every other review — task, phase, and final |

The models are named by family rather than by version. On Claude Code each agent declares `haiku`,
`sonnet`, or `opus`, so it tracks the current version of that family without anyone editing a file.

## How a task finds its agent

Every task carries a complexity — `simple`, `standard`, or `complex` — assigned when the Master Plan
was written. That one field decides who picks the task up and who checks it.

| `complexity` | Coder | Task reviewer |
|---|---|---|
| `simple` | `coder-junior` | `reviewer-junior` |
| `standard` | `coder` | `reviewer` |
| `complex` | `coder` | `reviewer` |

Standard and complex route to the same pair, so the line doing the real work is `simple` versus
everything else — it's the only one that hands a task to Haiku on both sides. A plan full of small,
well-specified tasks runs cheaper than the same work written as fewer heavy ones.

Phase and final reviews aren't in that table because there's no task complexity to read. Both always
go to `reviewer`; there's no junior tier above task scope. A phase review is judging how several
tasks fit together and a final review is checking a whole project against your requirements, and
neither is a job for a small model.

The plan records a complexity, never an agent name — which agent runs is worked out at spawn time.
For where complexity is written down, see: [Task Handoff](document-types.md#task-handoff).

## `coder-senior` is break-glass

No complexity routes to `coder-senior`, and it never picks up a task on its first attempt. It exists
for one situation: a corrective that keeps failing.

When a review asks for changes, the coder is re-spawned against the same Task Handoff plus the review
report — and those re-spawns aren't pinned to the tier the task started on. Early on it keeps the
original tier, since a couple of findings against a simple task usually means the task was
underspecified rather than the agent too small. As the attempts run down it steps up one rung at a
time: `coder-junior` to `coder`, then `coder` to `coder-senior` for the last attempt or two.

The budget is `max_retries_per_task`, five by default. Escalation buys a stronger coder for the
attempts that remain — it doesn't buy more attempts, and when they're gone the run halts whatever
tier it reached. So an escalation is worth looking at rather than waiting out: by the time Opus is on
a task, two cheaper agents have already failed it. For more details, see:
[When a review asks for changes](pipeline.md#when-a-review-asks-for-changes) and
[limits.max_retries_per_task](configuration.md#limitsmax_retries_per_task).

## The pipeline can't route to your own agents

Routing resolves to one of the five above, and there's no setting that adds to the list. If you've
written a custom agent of your own — a domain expert for your billing code, a reviewer that knows
your accessibility standards — the pipeline won't dispatch to it during a run.

Encode that knowledge as a skill instead, or as a plain document you can point the planner at. Both
get read while the plan is being written, and what they carry gets written into the tasks that need
it. Raise it during brainstorming so it lands in the Requirements doc — a skill in the skills list, a
document under `## Companion Documents` — rather than living only in the session where you mentioned
it. For more details, see: [Requirements](document-types.md#requirements) and
[Your own skills reach them through the plan](#your-own-skills-reach-them-through-the-plan).

## What they're allowed to read

A coding agent reads its Task Handoff and the files that handoff points it at. It's explicitly told
not to open your Requirements, the Master Plan, or the Phase Plan it belongs to, because a coder that
reads the whole plan starts building against the whole plan instead of its own task.

Reviewers work the same way, each one document down from the last. A task reviewer reads that task's
handoff, a phase reviewer reads the Phase Plan, the final reviewer reads your Requirements. None of
them reads what sits above it, and none reads another reviewer's report — a reviewer holding every
document ends up reviewing the plan instead of the code.

Which puts the weight on the plan: there's nowhere else for a coding agent to look, and no way for it
to ask you. For more details, see:
[Why it has to be self-contained](document-types.md#why-it-has-to-be-self-contained).

## What they're allowed to write

Coders write source code and tests, an `## Execution Notes` appendix at the end of their own handoff,
and — when the run has auto-commit on — their own commit. That's the whole surface.

Reviewers write one thing: the review report. They read the diff, run the build and the test suite
themselves rather than trusting what the coder said about them, and record each finding with a
`file:line`, the evidence, and a concrete fix.

The rule reviewers are held hardest to is about git. A review runs inside the project's live worktree
and must not move `HEAD` — no checkout, no commit, nothing that touches the index. And if the git
state already looks wrong, the reviewer doesn't repair it. It reports what it saw and returns
`rejected`, which halts the run to you, because a diff you can't trust isn't worth reviewing.

>Note: Coders and reviewers are granted the same tools. What separates them is instruction rather
than permission — a reviewer *can* edit a source file and is told not to.

## The skills they run

Each agent carries its own skills, named in its own definition and the same on every project.

Coders load two. **`rad-execute-coding-task`** is the workflow and the engineer's charter it's held
to: serve the task and nothing more, never silence the type-checker or linter to turn red green,
never add or upgrade a dependency the task didn't authorize, write tests that assert real behavior.
**`rad-source-control`** is how it commits and pushes its work when the spawn prompt directs it to.

Reviewers load one. **`rad-code-review`** defines the two lenses every review looks through —
*conformance*, did this diff deliver what its scope owed, and *quality*, read the diff as an engineer
and hold it to the same charter the coder was held to. Both feed one numbered findings list, and the
highest-severity finding sets the verdict.

That shared charter means a finding isn't one agent's taste applied to another's work — it's a rule
the coder was given too, and either kept or didn't. For more details, see:
[The ones agents load](skills.md#the-ones-agents-load).

### Your own skills reach them through the plan

Those three are the only skills a subagent loads. Your repo's skills aren't among them — subagents
don't inherit skills from your session, so a coding agent can't reach for your `@component-design`
skill mid-task even though it's installed and you use it every day.

They get applied earlier instead. During brainstorming the Requirements doc collects the skills
relevant to the project, and while the Master Plan is being written the planning agent reads them and
writes the conventions they carry into the tasks that need them. On a multi-repo project the same
thing happens per repo — each repo's skills are mined separately and applied to the tasks touching
that repo.

So a skill still shapes the code. It just arrives as part of the handoff instead of as something the
coder loads, which makes that list in the Requirements worth a look before you plan: a skill missing
from it is a convention no task will apply. For more details, see:
[How skills are applied](planning.md#how-skills-are-applied).

>Tip: If you need a subagent to read a skill verbatim rather than work from the planner's summary of
it, say so during brainstorming — then the task itself carries the instruction to go read it.

## The tools they get

All five agents get the same kit: read files, search the codebase, create and edit files, and run
shell commands, which is what lets them build, test, and commit rather than just produce text.

Tool *names* differ by harness — Claude Code's `Read`, `Grep`, and `Bash` are Copilot's `read`,
`search`, and `execute` — while what the agent can do stays the same.

### MCPs are resolved at planning time

The only MCP servers a subagent has are the browser ones: Playwright and Chrome DevTools, plus Claude
in Chrome on Claude Code. That's what lets a task that changes a screen be exercised in a real
browser instead of only compiled.

Nothing else is reachable, including whatever you have running yourself. A coding agent can't query
Context7 or hit a Jira MCP mid-task, even though both work in the session you're sitting in.

The call happens earlier instead. Ask for an MCP during brainstorming, and while the Master Plan is
being written the planning agent is the one that queries it and writes what it learned into the tasks
that need it. A library's current API lands in the handoff as a resolved contract rather than as an
instruction to go look it up — which suits the coder better anyway, since it isn't spending its own
context re-deriving something the planner already paid for.

For more details, see: [How skills are applied](planning.md#how-skills-are-applied).

## About the models

Your model choice drives the orchestrator, not these agents. Each one declares its own model, so the
agent writing your code is on Sonnet regardless of what you're running the orchestrator on, and
there's no Rad Orc setting that changes it.

How firmly that declaration holds depends on your harness. **Claude Code** honors it, unless your
organization restricts which models are available — then it substitutes an allowed one and tells you.
**Copilot** treats it as a priority list, so the declared model is a preference that falls back to
what your plan allows.

The same agent is also spelled three different ways, one per harness: `coder-junior` is `haiku` on
Claude Code, `claude-haiku-4.5` on Copilot CLI, and `Claude Haiku 4.5 (copilot)` in VS Code. That's
why the plugin you install has to match the harness you run it in. For more details, see:
[Install](install.md#install).

For what to run the orchestrator itself on, see: [Starting a run](pipeline.md#starting-a-run).

---

**Read Next:** [Execution Pipeline](pipeline.md) · [Document Types](document-types.md) ·
[Planning](planning.md) · [Skills](skills.md) · [Configuration](configuration.md) ·
[Docs Viewer](docs-viewer.md)
