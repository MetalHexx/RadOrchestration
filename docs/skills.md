# Skills

A skill is a set of instructions an agent loads when it needs them, rather than carrying all the
time. Rad Orc ships two kinds: commands you type, and references the agents load themselves as the
pipeline puts them in position.

This page is the index. Each row points at the page that actually explains the thing.

## The ones you type

Invoke a skill by typing its name after a slash — `/rad-execute`. What actually resolves depends on
the harness: Claude Code and Copilot VS Code namespace plugin commands under the plugin name
(`/rad-orc:rad-execute`, `/rad-orc-vscode:rad-execute`), while Copilot CLI takes the bare name as
written. These docs write the bare form throughout for readability — add your harness's namespace
when you type a command for real.

| Command | What it does | Where it's documented |
|---|---|---|
| `/rad-brainstorm` | Talks through what you're building until the goals hold up, and scribes a Requirements doc as consensus forms. | [Brainstorm](planning.md#brainstorm-align-and-create-requirements) |
| `/rad-plan` | Turns approved requirements into a Master Plan, then explodes it into phases and tasks. Asks you for review intensity and task size on the way. | [Master Plan](planning.md#master-plan-creating-an-execution-plan) |
| `/rad-execute` | Runs the plan. Also what you type to resume one that stopped partway. | [Starting a run](pipeline.md#starting-a-run) |
| `/rad-amend` | Changes a plan execution has already sealed — adds a phase or task, rewrites one that hasn't run, or drops one. Works mid-run and after the project completed. | [Amendments](amendments.md) |
| `/rad-project` | Answers what projects exist, what state each is in, how they relate, and where a project's worktrees are. Also creates the links between them. | [Seeing the graph](projects.md#seeing-the-graph) |
| `/rad-session` | Saves this conversation's progress against a project, resumes a previously saved session, or lists a project's saved sessions with their activity trail. Fires from plain language too — no slash command required. | [Sessions](sessions.md) |
| `/rad-repo` | Registers repositories and repo-groups, and answers where a piece of code actually lives. | [Repository Registry](repo-registry.md) |
| `/rad-visual-docs` | Generates a visual — a summary, a UI wireframe, or an architecture diagram — into the project folder. | [Visual Documents](visual-docs.md) |
| `/rad-init` | Sets how much the session-start briefing shows, from full banner to off. | [Ambient Awareness](ambient-awareness.md#setting-the-level) |
| `/rad-communication` | Switches how the agent talks to you, or turns the feature off. | [Communication Styles](communication-styles.md) |
| `/rad-ui-start` | Starts the dashboard and hands back its URL. | [Dashboard](dashboard.md) |
| `/rad-ui-status` | Reports whether the dashboard is running. | [Dashboard](dashboard.md) |
| `/rad-ui-stop` | Stops the dashboard. | [Dashboard](dashboard.md) |
| `/rad-portfolio` | Starts a long-running initiative, orients you in one that already exists, and records what each iteration actually delivered. | — |
| `/rad-help` | Accesses the documentation that ships with your install — a walkthrough of Rad Orc, a tour of what you can do, or an answer about any command. | [Rad Orc README](../README.md#help-when-you-want-it) |

Three of those carry a project from idea to merged code: `/rad-brainstorm`, then `/rad-plan`, then
`/rad-execute`, in that order. `/rad-amend` is the fourth on that path but only sometimes — it's how
you change the plan once running it has already begun. The rest are there when you want them — the
registry ones early, `/rad-session` any time you want to save, resume, or list a session's
progress, the dashboard whenever you'd rather watch a run than read it, and `/rad-init` and
`/rad-communication` once to set a preference you'll rarely revisit.

## The ones agents load

You don't invoke these. An agent reaches for one when it's doing the job that skill describes — the
orchestrator loads its playbook, a coder loads the coding workflow, a reviewer loads the review
standard. They're listed so that a name you see in a log or a slash menu isn't a mystery.

| Skill | Who loads it | What it governs |
|---|---|---|
| `rad-orchestration` | the orchestrator | How to drive the pipeline — signal an event, resolve the action that comes back, spawn who it names. See [What's driving the run](pipeline.md#whats-driving-the-run). |
| `rad-create-plans` | the main agent, while planning or amending | How the Requirements doc, the Master Plan, and an amendment get written, and what has to be in each. See [Document Types](document-types.md). |
| `rad-execute-coding-task` | coders | The coding workflow, and the engineer's charter every coder is held to. See [The skills they run](subagents.md#the-skills-they-run). |
| `rad-code-review` | reviewers | The two lenses a review looks through and how findings become a verdict. See [The skills they run](subagents.md#the-skills-they-run). |
| `rad-source-control` | the main agent and coders | Commits, pull requests, and creating or cleaning up a project's worktrees. See [Source Control](source-control.md). |
| `rad-log-error` | the orchestrator | Appending to the project's error log when the pipeline reports a failure. See [The error log](document-types.md#the-error-log). |

These are also the honest answer to "what is the agent actually doing right now." A run isn't
improvising — at every step something is following one of the skills listed above.

## Your own skills

Skills aren't only ours. If your repo has its own — a testing convention, a component pattern, a
house style — the planner collects them while the plan is being written and folds what they say into
the tasks that need it.

That's the route that works, and it's worth knowing it's the only one: a coding agent can't load one
of your skills mid-task. For how they get mined and applied, see:
[How skills are applied](planning.md#how-skills-are-applied). For why the subagents can't reach them
directly, see:
[Your own skills reach them through the plan](subagents.md#your-own-skills-reach-them-through-the-plan).

>Note: Skills in your repo whose names start with `rad-` are skipped when the planner collects them,
so the system never confuses one of yours for one of its own. Pick a different prefix and it'll be
found.

---

**Read Next:** [Planning](planning.md) · [Execution Pipeline](pipeline.md) ·
[Amendments](amendments.md) · [Subagents](subagents.md) · [Projects](projects.md) ·
[Dashboard](dashboard.md) · [Docs Viewer](docs-viewer.md)
