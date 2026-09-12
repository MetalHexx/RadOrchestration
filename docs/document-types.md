# Document Types

Rad Orc runs on markdown. Everything a project knows about itself is a plain file in its project
folder — readable, greppable, and yours. This page is the reference for what's inside each one.

For where these files live and how a folder fills up as a project moves, see:
[What accumulates in a project folder](projects.md#what-accumulates-in-a-project-folder). For how
they get produced during a run, see: [Execution Pipeline](pipeline.md).

Two files in the project folder aren't documents. `template.yml` and `state.json` are written and
read by the machinery — see [What's driving the run](pipeline.md#whats-driving-the-run).

## Frontmatter is load-bearing

Every generated document opens with a small YAML block. It isn't decoration for you to skim past.
The CLI reads it and makes decisions from it.

Three things that depend on it:

- The pipeline decides whether to create a corrective by reading `verdict:` off a review report.
- The plan split checks `repos:` on the Master Plan against every task in it, in both directions,
  and refuses to emit anything if the two disagree.
- `total_phases` and `total_tasks` seed the shape of the run.

So **don't hand-edit frontmatter.** Read as much of it as you like. If a value looks wrong, the fix
is upstream — tell your agent, and the document gets re-authored or regenerated with frontmatter
that matches it. Editing a field by hand doesn't correct the run's understanding of the project. It
just makes the file disagree with it, and nothing will warn you.

## Requirements

`{PROJECT-NAME}-REQUIREMENTS.md` — written by you and the agent during `/rad-brainstorm`.

What you're building and why, and the most important document in the folder.

- **Goals** and **Non-Goals** — what's in scope, and what you decided against on purpose.
- **Requirements** — numbered `R1`, `R2`, and so on. These get carried down into the tasks that
  deliver them, and they're what the final review checks the finished project against.
- **Technical Specification**, including security considerations.
- **UI/UX Design** and a **Testing Approach**.
- **Affected Repositories** — the repos in scope, split into what changes and what's read for
  reference.
- **Required Skills and MCPs** — surfaced during brainstorming. The planning agent reads this to
  work out which conventions to bake into which tasks.
- **Key Files & Modules** and **Reference** — grounding for the planner.
- **Companion Documents** — where a design doc, diagram, or spec you supplied gets linked so a
  later session can find it.
- **Open Questions** — anything you couldn't settle. Whatever's still open when planning starts
  gets answered by the agent on its own.
- **Amendments** — only appears if the plan changed after the run started. One entry per
  [amendment](#amendment), each carrying that amendment's rationale, what it revised or dropped, and
  a link to the amendment document. The section is appended to the end; the requirements you
  originally wrote are never edited.

**Frontmatter worth knowing:** `status` is `draft` while you're shaping it and `approved` once
planning has started against it. `repos`, `repo-group`, and `project-type` (`standard` or
`side-project`) describe the scope. `template` and `task-size` get stamped in when planning begins,
recording the review tier and the sizing you chose — handy when you come back in a month and can't
remember what you picked.

For more details, see:
[Spend most of your time on requirements](planning.md#spend-most-of-your-time-on-requirements).

## Master Plan

`{PROJECT-NAME}-MASTER-PLAN.md` — written by the agent during `/rad-plan`.

The whole execution plan in one document, and the only one of these you ever edit by hand.

- **Introduction** — two or three sentences on what's being built.
- **Execution Map** — the whole plan on one screen. Each phase is a bold label with a small table
  of its tasks showing the repo, the complexity, and a one-line purpose. Read this first.
- **A block per phase** — `## P01: {Title}`, carrying Intent, Exit criteria, and Integration seams.
- **A block per task** — `### P01-T01: {Title}`, carrying the full handoff body.

The phase and task blocks are the anchors the plan split reads. Their bodies get copied word for
word into the Phase Plans and Task Handoffs, which is why those documents don't need authoring
separately. For more details, see: [The explosion](pipeline.md#the-explosion).

**Frontmatter worth knowing:** `repos` is a seal on the whole project — see
[How repos narrows down the chain](#how-repos-narrows-down-the-chain). `total_phases` and
`total_tasks` give you the plan's size without scrolling, and seed the run.

For more details, see: [Final Plan Review](planning.md#final-plan-review).

## Amendment

`{PROJECT-NAME}-AMENDMENT-{NN}.md` — written by the agent during `/rad-amend`.

A change to a Master Plan that execution has already sealed. Only appears if the plan changed after
the run started — a plan edited before that is simply re-authored, and leaves no amendment behind.
A project can have several, numbered from `-01`, and none is ever overwritten.

An amendment isn't a copy of the plan with edits made to it. An amendment is the delta and nothing
else:

- **Rationale** — why the change is being made, in your own words. This is the section a person
  reads a month later to understand why the project's scope moved.
- **The phase and task blocks the amendment carries** — written in exactly the Master Plan's form,
  because those blocks get folded straight into the Master Plan. Whether a block is being inserted
  or is rewriting a block already in the plan is declared in the frontmatter rather than guessed at
  from the id the block uses.

Applying an amendment rebuilds the Master Plan, rewrites the Phase Plans the amendment touched, and
appends a record of the change to the Requirements doc — so once an amendment lands, the plan
documents read as though the project had always been scoped that way. The amendment document stays
behind as the record of what changed, and why.

**Frontmatter worth knowing:** each amendment declares what it does to the plan — which phases and
tasks it adds, which it rewrites, and which it drops — and the CLI checks those declarations against
the work that has already run before applying anything. There's no `repos:` seal on an amendment,
because an amendment holds only part of the plan; repo scope is checked once the amendment and the
plan have been merged.

Amendments never touch work that already ran, and never change the project's review intensity or
task size. For what the amendment workflow looks like from your side, see:
[Amendments](amendments.md).

## Phase Plan

`{PROJECT-NAME}-PHASE-{NN}-{SLUG}.md` in `phases/` — generated from the Master Plan.

One per phase, and the phase reviewer's entire contract. It holds three things:

- **Intent** — the capability that exists once this phase is done.
- **Exit criteria** — concrete, checkable conditions. The phase reviewer verifies each one against
  the code and records whether they were met.
- **Integration seams** — the cross-task and cross-repo boundaries this phase ties together, like
  an endpoint and the view that calls it.

The phase reviewer works from this document and the phase's diff, and nothing else. So exit
criteria written as "the feature works" get you a phase review that can't tell you much, while
"the endpoint returns 404 for an unknown id and the view renders its empty state" get you one that
can.

**Frontmatter worth knowing:** `tasks` lists the phase's tasks by id and title — the fastest way to
see a phase's shape. `repos` is the union of the repos its own tasks target.

## Task Handoff

`{PROJECT-NAME}-TASK-P{NN}-T{MM}-{SLUG}.md` in `tasks/` — generated from the Master Plan.

The document that turns into code. One per task, and the only thing its coding agent gets.

| Section | What's in it |
|---|---|
| Task type · Complexity · Target repo | Complexity decides which coding agent picks up the task. Target repo names the one repo it writes to. |
| **Files** | What to create, what to modify, and what to read for patterns. |
| **The change** | The actual contract — the signature, endpoint, type, or data shape to build. Shapes, not implementations. Plus the seam that has to line up with a task in another repo. |
| **External surface** | Anything the task builds against but doesn't own: the exact import statements, plus the real type definitions copied out of the source. |
| **Done when** | The acceptance criteria the task reviewer checks against. |
| **Testing** | What's worth covering, and what to skip. |
| **Execution Notes** | Left empty. The coding agent appends what it did and anything surprising it hit. |

**Frontmatter worth knowing:** `complexity` (`simple`, `standard`, or `complex`) is what routes the
task to a coding agent — see
[How a task finds its agent](subagents.md#how-a-task-finds-its-agent). `status` starts at
`pending`. `repos` carries the
single repo this task writes to.

### Why it has to be self-contained

A coding agent reads its Task Handoff and nothing else — not your requirements, not the Master
Plan, not even the Phase Plan it belongs to. It can read the codebase, but it can't read the
planning corpus and it can't ask you a question. So the planning agent does three specific pieces
of work to make the handoff stand on its own.

**It brings the requirements down.** The relevant `R{n}` requirements, spec details, and testing
approach get written into the tasks that deliver them. The coding agent never sees your Requirements
doc — it sees the part of it that applies to its task.

**It bakes in skills and conventions.** Subagents don't inherit skills from your session, so reading
a skill at execution time isn't an option. Instead the planning agent reads the skills that match
the work, along with the `CLAUDE.md` / `AGENTS.md` files covering the areas being touched, and
writes those conventions into the tasks that need them. A convention left out of a handoff is a
convention that won't get applied. For more details, see:
[How skills are applied](planning.md#how-skills-are-applied).

**It resolves external shapes instead of naming them.** When a task builds against a type defined
somewhere else, the plan pins the real definition into the handoff. Just naming it sends the coding
agent off to re-open a file the planning agent already read and paid for.

Which is why the plan decides how well a project lands. What the coding agent knows is what
somebody wrote down.

### One repo per task

Every task targets exactly one repository. This is enforced, not a convention — the plan split
rejects a plan whose tasks don't line up with the repos the project declared.

The reason is that a task is the unit one agent executes end to end. Give it two repos and that
agent has to hold two codebases in one context window, and its commit straddles two histories so
neither one can be diffed cleanly against the work. Reviews lose their boundary and cost goes up
for no benefit.

So cross-repo work isn't one task. It's **two tasks under one phase**, each pinning the same agreed
contract on its own side, so each repo can be built and reviewed independently. A phase spans repos;
an authored task never does.

That leaves an obvious risk — two sides of a contract written independently might not actually
agree. Closing it is exactly what phase review is for, and the Phase Plan's Integration seams tell
it where to look. For more details, see: [How code review works](pipeline.md#how-code-review-works).

**The exception is a corrective with no task behind it.** Phase-scope and final-scope correctives
are driven by a review report rather than a Task Handoff, so there's no `Target repo:` line to pin
them to one repo. Each finding in the report carries its own `**Repo:**` field instead, and the
coding agent resolves per finding — so one of those passes can legitimately touch several repos. The
rule holds where it counts: nothing the *plan* authors spans repos. When a corrective does, it's
because a review found related problems on both sides of a seam, and fixing them together is the
whole point.

### How repos narrows down the chain

`repos` appears on four documents, and it means something slightly different each time:

| Document | What `repos` means there |
|---|---|
| Requirements | the repos in scope for the project |
| Master Plan | a **seal** on the whole project — every task must target a repo inside it, and every repo in it must be claimed by at least one task |
| Phase Plan | the union of the repos this phase's own tasks target |
| Task Handoff | the one repo this task writes to |

The seal is checked in both directions, so a repo you listed and then forgot to use gets caught at
the split rather than halfway through a run. For more details, see:
[Repository Registry](repo-registry.md).

### Why the handoffs stay portable

Look at the `Files` paths in a task and you'll notice they're repo-relative, and the repo itself is
named rather than located — `search-api`, not `C:\Users\you\code\search-api`.

Real paths get handed to the agent at spawn time, worked out from the run's own state. So your
planning documents hardcode nothing about your machine. The same plan runs in a worktree, in your
own clone, or on a teammate's laptop, and the repo name resolves to wherever that repo actually
lives.

## Review reports

In `reports/`, written by the reviewer agents during the run. There are three, and they differ in
what they're checked against:

| Report | Filename |
|---|---|
| Code review (task scope) | `{PROJECT-NAME}-CODE-REVIEW-P{NN}-T{MM}-{SLUG}.md` |
| Phase review | `{PROJECT-NAME}-PHASE-REVIEW-P{NN}-{SLUG}.md` |
| Final review | `{PROJECT-NAME}-FINAL-REVIEW.md` |

All three share a shape:

- **Verdict** — one line naming the finding that drove it.
- **Summary** — what the diff actually shows, not what the plan asked for.
- **Scope** — one block per repo: the commits under review, the exact diff command run, and the
  `git diff --stat` pasted verbatim.
- **Tests** — the command run, the named results, and whether the build passed.
- **What went well.**
- **Findings** — numbered, each with a repo, a `file:line`, quoted evidence, the problem, and a
  concrete fix.
- **Coder Dispositions** — left empty by the reviewer.

That last section is what makes these documents worth opening. A review report is a **two-way
document**. When a review asks for changes, the coding agent writes into this same file: for each
finding it either records the fix or disputes the finding with evidence. Then the same reviewer
reopens the file and rules on the response. There's one report per review, updated in place across
every corrective cycle — so when you want to know what happened on a task that took three passes,
you read one file with the whole argument in it.

**Frontmatter worth knowing:** `verdict` is `approved`, `changes_requested`, or `rejected`, and the
pipeline routes on it. `severity` is the highest finding's severity — `none`, `low`, `medium`, or
`high`. Phase reviews add `exit_criteria_met`, a straight yes or no on whether the phase cleared
the bar its Phase Plan set.

For what each verdict does to the run, see:
[When a review asks for changes](pipeline.md#when-a-review-asks-for-changes).

## The error log

`{PROJECT-NAME}-ERROR-LOG.md` — written by the pipeline, and only there if something went wrong.

Append-only. Each entry records the pipeline event and action that failed, a severity, the phase and
task it happened on, the symptom, the raw output, a root cause where one is obvious, and whatever
workaround got applied.

If a run halts, this is the first file to open. It's also the right thing to attach when you report
a problem.

## Visual documents

Not everything in a project folder is markdown. `/rad-visual-docs` writes self-contained HTML into
the project folder alongside the planning documents — a brainstorming summary, a UI wireframe, or an
architecture or data-flow diagram — so a picture stays with the work instead of scrolling out of a
conversation.

They're named for what they are (`{PROJECT-NAME}-BRAINSTORM.html`,
`{PROJECT-NAME}-WIREFRAME-{SLUG}.html`, `{PROJECT-NAME}-TECH-DIAGRAM-{SLUG}.html`), and they get
linked from the Requirements' `## Companion Documents` section so a later session can find them.

One thing sets them apart from everything else on this page: they aren't part of the run's document
chain **by default**. Nothing routes a visual to an agent during execution, and no review checks the
work against one. Left alone, they're for you and your team.

**You can opt in — but you have to ask for it while you're brainstorming.** Say it before the
Requirements are written: that a particular mockup is the reference for the UI, and that the definition
of done includes comparing the built screen against it. That lands the instruction *in the
Requirements*, which the planner reads when it writes the plan and the reviewer reads when it checks
the work. Bring it up after planning and it isn't in the document chain, so nothing acts on it.

Worth doing when you've paid for a high-fidelity mockup — it's the difference between the agent
building toward a picture and building toward a paragraph. See
[Use them for UI review during execution](visual-docs.md#use-them-for-ui-review-during-execution).

For more details, see: [Visual Docs](visual-docs.md) and
[Visuals land here too](projects.md#visuals-land-here-too).

## Documents you add yourself

Anything else you drop in the project folder is picked up and shown alongside the generated
documents, and visuals your agent draws land there too. For more details, see:
[Documents you add yourself](projects.md#documents-you-add-yourself).

---

**Read Next:** [Planning](planning.md) · [Execution Pipeline](pipeline.md) ·
[Projects](projects.md) · [Amendments](amendments.md) · [Subagents](subagents.md) ·
[Repository Registry](repo-registry.md) · [Docs Viewer](docs-viewer.md)
