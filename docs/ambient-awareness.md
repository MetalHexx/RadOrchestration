# Ambient Awareness

An agent running in a terminal knows the folder you started it in and nothing else. It doesn't know
your other repositories exist, which projects you have in flight, or how the system around it is
configured. Ask it anything that reaches past that folder and it can only guess.

**Ambient awareness is what your agent knows about the world around your working directory, before
you've typed a word.** Every session opens with a briefing loaded straight into its context, and it
answers two questions: what else is out there, and where am I standing right now. You get the same
briefing whether or not you're running a [pipeline](pipeline.md) project.

## What else is out there

The agent immediately understands the world around it: Your projects, your registered repos, and specific knowledge on the current project its standing in.

When you start a session, you'll be greeted by a preamble that looks something like this:

```
Rad Orc — environment loaded · you're in SEARCH-PLATFORM › SEARCH-FILTERS

Repos (4) · search-api · search-ui · design-system · platform-infra
Repo Groups (2) · search · platform
Active Portfolios (1) · SEARCH-PLATFORM
Active Projects (2) · SEARCH-FILTERS (Executing) · SEARCH-RANKING (Pending Review)
Config · auto-commit ask · auto-pr ask · observability on · communication style off
```

This briefing contains some basic information about your operating environment:
- **Repos**: All the repos you have registered in the [Repository Registry](repo-registry.md) — by name only.  The names tell the agent what exists; it reads a repo's description later, if that repo becomes relevant.
- **Repo Groups**:  All the domains you have registered in the [Repository Registry](repo-registry.md)
- **Active Portfolios**: Portfolios — long-running initiatives held as a root project's documents plus the iteration projects beneath it — whose lifecycle is currently `active` (as opposed to on hold or done). See `/rad-portfolio`.
- **Active Projects**: Every project with a run in flight — `Planning`, `Planned`, `Executing` or `Pending Review` — each with the state it's in
- **Config**: A few of your current global settings

>The repo registry alone earns its keep here.  Even if you're not using Rad Orc pipeline projects, you'll still benefit from the repo information that is provided to your agent.

### Unfinished work stays in view

A project waiting at the final approval gate sits in `Pending Review`, and because that still counts
as a run in flight, it keeps appearing in every session's briefing until you deal with it.

That's on purpose.  A project that's been built but not reviewed is the easiest thing in the world to
forget once you close the terminal.  Leaving it pending is a legitimate choice — better than
rubber-stamping it — and the briefing keeps that choice in front of you.  See
[Project states](projects.md#project-states) and [Finishing the run](pipeline.md#finishing-the-run).

### Where you are
If you're standing in a workspace related to your project, the agent already knows what you're working on.  It infers this from where your terminal is — when running projects in Rad Orchestration, you're usually standing in the project workspace located at `~/.radorc/worktrees/<PROJECT-NAME>`.  When that's the case, your agent receives additional context about the project including:

- **Project Document Paths**: Paths to all your project docs.  See: [What accumulates in a project folder](projects.md#what-accumulates-in-a-project-folder)
- **Project Repos**:  Information about which repos are in scope for this project.  See: [Repository Registry](repo-registry.md)
- **Linked Projects**:  Information about projects linked to this one.  See: [Linking Projects](projects.md#linking-projects-together)

### Standing in a portfolio

If the project you're standing in is an iteration of a portfolio and that portfolio is currently
active, the breadcrumb grows a segment in front of the project name — broad to narrow:

```
Rad Orc — environment loaded · you're in SEARCH-PLATFORM › SEARCH-FILTERS
```

The agent also gets the portfolio's root document — the one page that maps what the initiative
is, where it stands, and which of its other documents answers what — so it knows where to look
without asking you. It defers actually opening that document until your request touches
portfolio-level context, and the rest of the portfolio's documents stay behind `/rad-portfolio`
rather than loading by default.

### When several projects share a workspace

Running a follow-up in an earlier project's workspace is normal, so the line has to handle more than
one answer:

```
Rad Orc — environment loaded · you're in SEARCH-FILTERS → SEARCH-FILTERS-2 → SEARCH-FILTERS-3
```

They're in series order, and the last is emphasized — that's the one the agent gets full detail on,
while the rest collapse to a line each.

**An arrow asserts a real relationship.**  Projects are joined by arrows only where you've actually
linked them; ones that merely share a folder get a `·` instead.

```
Rad Orc — environment loaded · you're in SEARCH-FILTERS → SEARCH-FILTERS-2 · SEARCH-EXPORT
```

Arrows through everything in the folder would invent a series, and the agent would then work from an
order that doesn't exist.  See
[Running a follow-up in the same workspace](pipeline.md#running-a-follow-up-in-the-same-workspace)
and [Linking projects together](projects.md#linking-projects-together).

## How much of it you see

Four levels, and the distinction that matters is between what you're *shown* and what the agent
*receives*. 

| Level | What you see | What the agent gets |
|---|---|---|
| `verbose` | The full briefing | Everything |
| `minimal` (default) | One line — the breadcrumb: which project you're standing in and, when it's an iteration of an active portfolio, which portfolio too | Everything |
| `silent` | Nothing at all | Everything |
| `off` | Nothing at all | Nothing |

So `minimal` and `silent` are about noise in your transcript, not about what your agent knows — at
`silent` it still starts every session fully oriented, you just stop reading about it. Only `off`
withholds anything, and it withholds all of it. `minimal` keeps the breadcrumb because, of
everything on the briefing, which project (and portfolio) you're in is the one fact that changes
session to session.

**If you're upgrading, nothing changes without your say-so.** A config that already has an
`ambient_awareness` setting — any value, including a previously-shipped `verbose` — keeps exactly
what it has. The new `minimal` default only reaches a fresh install and a config that has never
carried an ambient-awareness setting at all; everywhere else, what you already had is what you
keep.

### Setting the level

If the one-line default isn't enough, or you'd rather see nothing at all, you can change it.

`/rad-init <level>` sets it in any harness — Claude Code, Copilot CLI, Copilot in VS Code. It
persists, and takes effect from your next session, since the briefing is assembled as a session
starts.

The same skill does two more things:

- **`/rad-init`** on its own prints the full briefing right now, whatever level you're set to. It's a
  preview, not a change — handy at `silent` to see what your agent is working with.
- **`/rad-init help`** has the agent explain the levels and how to change them.

You can also set your verbosity level without spending tokens: the dashboard's gear-icon config panel has an **Ambient
Awareness** field. Or edit `ambient_awareness.verbosity` in your `orchestration.yml` directly. See
[Dashboard](dashboard.md) and [Configuration](configuration.md).


## /rad-repo and /rad-project skills
In addition to the ambient awareness your agent receives on session start, these 2 skills allow an agent to dig more into your registered repos or other projects that are not in scope if it becomes a topic of conversation.  See [Projects](projects.md), [Repo Registry](repo-registry.md) and [Skills](skills.md)

## Communication style is a separate layer

Ambient awareness governs what your agent *knows* at session start. Communication style governs how
it *talks to you*. They ride the same session start and are configured independently, which means a
communication style still applies with ambient awareness set to `off`. See
[Communication Styles](communication-styles.md).

>Contributing to Rad Orc?  How the briefing is assembled, gated by level, and serialized for each
>harness is covered in [Ambient Awareness Internals](internals/ambient-awareness.md).

---

**Read Next:** [Repository Registry](repo-registry.md) · [Projects](projects.md) ·
[Source Control](source-control.md) · [Communication Styles](communication-styles.md) ·
[Configuration](configuration.md) · [Dashboard](dashboard.md) · [Docs Viewer](docs-viewer.md)
