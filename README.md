# Rad Orc

<table>
  <tr>
    <td>
      <img src="assets/rad-orc.png" alt="Rad Orc" width="520">
    </td>
    <td>
      <blockquote>
        Hi, I am the Rad Orc.  I am an agentic coding environment designed to help you work faster while reducing fatigue when working on a high volume of work. Expectations are on the rise for how quickly we engineers can deliver.  I am here to help.  Take a look at what features I bring to the table below, or head over to the <a href="docs/getting-started.md">Getting Started</a> page for a quick tutorial. Once you're up and running, ask the <code>/rad-help</code> skill any time you want a guided tour or a quick answer.
      </blockquote>
    </td>
  </tr>
</table>

## What It Does

Rad Orc is a document-driven orchestration system that takes software projects from idea
through planning, execution, and review — on top of the AI coding assistant you already use.

Managing a high volume of work is its own kind of tax. Context switching, tracking which
plan is where, watching parallel terminals, remembering what you decided three projects
ago. Rad Orc exists to carry that load: you plan the work as markdown, the system executes
it with a team of agents, and everything stays visible in one dashboard.

### Plan your work

Spec-driven development, taken further. Large bodies of work break down into projects, then
phases, then tasks — every one of them a markdown document you can read, edit, and come back
to. Start with `/rad-brainstorm` to align on the problem, then `/rad-plan` to turn that into
an execution plan. Nothing gets built until you approve it.

[Planning →](docs/planning.md)

### Project memory

Projects don't stand alone. As you plan, they link to each other — this one follows that
one, this one was spawned from a bug found in another. The result is a map of what you've
built and what's coming, which gives the agent real context on day one of the next
iteration instead of a blank slate.

[Projects →](docs/projects.md)

### Send a team to do the work

`/rad-execute` deploys a team of subagents to work the plan task by task. Each one gets its
own context window, so it can focus hard on a single task instead of holding your entire
project in its head. Work is routed to the right agent for the job based on how demanding
the task is.

[Pipeline →](docs/pipeline.md) · [Subagents →](docs/subagents.md)

### Automated code reviews

Writing the code is the fun part. Reviewing it is not. The same agent team handles review,
and you decide how much of it the project warrants — four intensity tiers, chosen at
planning time. A quick exploration gets a light touch; a risky refactor gets defense in
depth. Higher tiers cost more tokens and take longer, so it's a real trade-off.

[Review tiers →](docs/pipeline.md#review-intensity)

### Work in parallel

By default, every project runs in its own git worktree — a full checkout of your repository in a
separate folder, on its own branch. Two agents can work two projects in the same repository
at the same time without ever touching the same file. Rad Orc creates and cleans up the
worktrees for you.

[Source control →](docs/source-control.md)

### The dashboard

Three projects running at once is three terminals you can't watch. The dashboard collapses
them into one live view — pipeline progress, documents as they're written, commits as they
land, and where your tokens went. It reads straight from the project files on disk, so it
never drifts from what actually happened. Start it with `/rad-ui-start`.

[Dashboard →](docs/dashboard.md)

### Commits and pull requests

Work gets committed as the agents go, so it's safe, portable between machines, and easy to
hand off. Reviewers use the commit diffs to see exactly what changed. When a project
finishes, it opens a pull request in **draft** — written up and ready, without signalling
your teammates to start reviewing before you've looked.

[Source control →](docs/source-control.md)

### Multi-repo awareness

Not everyone works in a monorepo, and CLI agents only really know the folder they're
standing in. Register the repositories you care about — wherever they live on disk — and
group them by relationship. The agent starts every session knowing what exists and how it
connects, so it can find the right repo without you pointing at it. Projects that span
repositories get their worktrees staged side by side under one parent folder.

[Repository Registry →](docs/repo-registry.md)

### Ambient awareness

At the start of every session, the agent is handed a short briefing: your repositories,
your active projects and their state, your current settings. Just enough to orient without
burning context. Four verbosity levels control how much of that you see — including one
that keeps the agent informed while showing you nothing.

[Ambient awareness →](docs/ambient-awareness.md)

### Communication styles

You can change how the agent talks to you. Four styles ship in the box, and you can write
your own. Styles govern tone and formatting only — never what the agent does, never the code
or documents it writes. Switch with `/rad-communication`.

[Communication styles →](docs/communication-styles.md)

### Custom actions

The execution loop is extensible. Drop plain-English instructions into any point in the
pipeline — before a task starts, after a review lands, when a phase closes. Post to Slack on
completion, move a Jira subtask, run a script. The dashboard's Instruction Editor lets you
browse every point in the loop and write into it.

[Custom instructions →](docs/custom-instructions.md)

### Real-time visual docs

A diagram often aligns people faster than a page of prose. Rad Orc spots the moments where
planning would benefit from one and generates it — architectural blueprints, sequence
diagrams, UI mockups. They render live in the dashboard as the agent writes them, so you can
react while the thinking is still in motion.

[Visual docs →](docs/visual-docs.md)

### Observability

See where your tokens and time actually went. Token counts, costs, agent transcripts, tool
calls, file changes — live while a project runs, or afterward for up to 14 days. Star a
session to keep it indefinitely, and compare two runs side by side.

[Observability →](docs/observability.md)

### Your project's journey

Every session that touches a project — planning it, building it, reviewing it — becomes part
of its journey. See the whole timeline on the project's Overview page, reopen any session
exactly where you left off, or check what it cost without leaving the row it's on.

[Sessions →](docs/sessions.md)

### Help when you want it

Documentation ships inside your install, so you get the full picture from day one — no web
browsing, no out-of-date tabs. `/rad-help` is your guide: start a walkthrough, explore what
Rad Orc does, or get an instant answer about any command.

[Skills →](docs/skills.md)

### Read it without leaving the dashboard

The whole documentation set also renders right inside the dashboard — click the question-mark
icon in the header and the page you need opens in place, read straight off the files that shipped
with your install rather than a tab that might be out of date.

[Docs Viewer →](docs/docs-viewer.md)

## Supported Harnesses

| Harness | Plugin | Status |
|---------|--------|--------|
| Claude Code | `rad-orc@rad-orc-marketplace` | Supported |
| Copilot CLI | `rad-orc@rad-orc-marketplace` | Supported |
| Copilot VS Code | `rad-orc-vscode@rad-orc-marketplace` | Supported |

Rad Orc installs as a plugin from the rad-orc-marketplace — a standard installer is available
where you need one.

[Install →](docs/install.md)

## Documentation

**Start here**

| Page | Description |
|------|-------------|
| [Install](docs/install.md) | Install, upgrade, and uninstall, per harness — hand this page to your agent. |
| [Getting Started](docs/getting-started.md) | One guided pass from an empty repository to a merged first project. |

**Core workflow**

| Page | Description |
|------|-------------|
| [Planning](docs/planning.md) | How work becomes a plan, and the choices you make along the way. |
| [Pipeline](docs/pipeline.md) | What happens after the plan is approved — gates, review tiers, corrective cycles. |
| [Amendments](docs/amendments.md) | Changing a plan that's already approved, mid-run or after it finished. |
| [Document Types](docs/document-types.md) | What's inside every document a project produces, field by field. |
| [Subagents](docs/subagents.md) | Who does the work, how it's routed to them, and what they're allowed to touch. |
| [Skills](docs/skills.md) | Every command you can invoke, every skill the agents load, and where each one is documented. |

**Features**

| Page | Description |
|------|-------------|
| [Projects](docs/projects.md) | What a project is, how projects relate, and how their files are laid out. |
| [Repository Registry](docs/repo-registry.md) | Making the agent aware of repositories beyond the current folder. |
| [Source Control](docs/source-control.md) | Worktrees, branches, commits, and pull requests. |
| [Ambient Awareness](docs/ambient-awareness.md) | What your agent knows at session start, and how much of it you see. |
| [Communication Styles](docs/communication-styles.md) | How your agent talks to you. |
| [Custom Instructions](docs/custom-instructions.md) | Injecting your own instructions into the execution loop. |
| [Visual Docs](docs/visual-docs.md) | Diagrams and mockups as first-class planning artifacts. |
| [Observability](docs/observability.md) | Seeing where your tokens and time went. |
| [Sessions](docs/sessions.md) | A project's journey — every session that touched it, and how to step back into one. |
| [Dashboard](docs/dashboard.md) | Every surface the dashboard offers. |
| [Docs Viewer](docs/docs-viewer.md) | Reading the documentation set without leaving the dashboard. |
| [Configuration](docs/configuration.md) | Every setting, its default, and where to change it. |

## Contributions and Feedback

Feedback and contributions are both welcome and appreciated.

[Feedback →](docs/feedback.md)
