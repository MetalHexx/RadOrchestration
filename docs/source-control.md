# Source Control

Rad Orc writes code with git, the same way you would — a branch, commits as the work lands, and a
pull request at the end. This page is about where that work happens and what it looks like when it
arrives.

Two things to know before the detail. Your own checkouts are never written to unless you ask for
it. And pull requests are **GitHub only** — they're opened with the `gh` command-line tool, which
has to be installed and signed in. [Install](install.md) covers getting that set up.

## Where the work happens

Your code isn't written in the folder you normally work in — that's the default. Each standard
project gets its own **workspace** under `~/.radorc/worktrees/<PROJECT-NAME>`, and that's where the
agents do their work. Two exceptions get their own sections below: running in your own checkout
instead, and side projects, which never get a worktree at all.

If you've not come across worktrees before, they're worth two minutes, because the whole shape of
this page follows from them.

Normally a git checkout can only be on one branch at a time. Switching branches rewrites the files
in front of you, which is fine when you're one person doing one thing, and a problem the moment two
pieces of work need to happen at once — you'd be fighting over the same folder. Git's answer is a
**worktree**: it can hand you a *second folder* checked out to a different branch of the same
repository. Same project, same history, same remotes — different files on screen. Nothing is
downloaded again; it reuses the repository you already have, so making one is close to instant.

That's what Rad Orc uses. Each project's work goes in a worktree of its own, which buys two
things: your own checkout is left exactly as you left it, and two projects can run at the same time
in the same repository without ever touching the same file.

## The workspace is a monorepo you didn't have to build

Here's the part worth understanding, because it's a reason multi-repo work is safe in Rad Orc.

A project can span several repositories. Each one gets its own worktree, and they all go in folders
underneath a **single parent folder named after the project**:

```text
~/.radorc/worktrees/SEARCH-FILTERS/     <-- the agent is started here
├── search-api/
└── search-ui/
```

The agent isn't started inside `search-api` or `search-ui`. It's started on the parent, looking
down at both.

That one detail does a lot of work. A command-line agent can only really see the folder it's
standing in, so standing it above the repositories means it sees all of them at once, side by side,
as if they were one codebase — a temporary monorepo assembled for this project and thrown away
afterwards. It can change the API and the UI in the same project without being told where either one
lives.

Just as usefully, it works the other way round. The only repositories in that folder are the ones
this project actually changes, so there's nothing else in view to get distracted by. The workspace
*is* the scope of the change.

Single-repo projects get the same layout — one folder instead of three. Nothing special happens for
the common case.

## Where those repositories come from

Nothing here is discovered by looking around your disk. The repositories in a project's workspace
are the ones the project declared during planning, and each name is resolved to a checkout on your
machine through your **repository registry** — the list of repositories you've told Rad Orc about,
and where each one lives.

That's also where the branch each worktree starts from comes from: every registered repository
records its own default branch. And it's why a run stops before it starts if a repository it needs
isn't registered, or is registered but has no local checkout on this machine — there'd be nothing
to make a worktree from. See [Repository Registry](repo-registry.md).

## One branch across every repository

Every repository a project touches gets the same branch name, taken from the project:

```
radorch/SEARCH-FILTERS
```

A three-repository change is three branches all reading `radorch/SEARCH-FILTERS`. That's what makes
it findable later — open any of those repositories and you can tell which project put that branch
there. Each branch starts from that repository's own default branch, so the base can differ from
one repository to the next.

That workspace folder name is what decides the branch, and it's the project name by default. It can
be pointed at a different project's workspace instead, which is how two projects end up sharing one
branch and one pull request. It's a real decision with review consequences —
[Running a follow-up in the same workspace](pipeline.md#running-a-follow-up-in-the-same-workspace)
covers when to do it.

## Commits

With auto-commit on, every task commits its own work as it finishes, so you get a commit per task
rather than one big one at the end:

```
feat(P01-T02): add the date-range picker to the filter panel

Adds a two-field range control to the filter panel, wired to the
existing query state. Handles the open-ended case where only one
bound is supplied.
```

Messages follow [Conventional Commits](https://www.conventionalcommits.org/), with the task's id
standing in for the usual scope, and the prefix picked from the task itself — `feat`, `fix`,
`refactor`, `test`, `docs` or `chore`. If the repository has a remote the commit is pushed; if it
doesn't, that's fine and nothing complains. Agents never force-push and never rewrite history.

Turning auto-commit off changes more than your history: reviews use commits to work out what to
look at, so without them all three reviews end up staring at the same undifferentiated pile of
changes. [Commits give your reviews their boundaries](pipeline.md#commits-give-your-reviews-their-boundaries)
makes the case in full, and
[Set your commit and PR preference once](pipeline.md#set-your-commit-and-pr-preference-once) covers
when you get asked and how to stop being asked.

## Pull requests

With auto-PR on, a project opens its pull request once the final review passes — **one per
repository**, and always as a **draft**.

Draft is the point. The change is written up and ready to read without telling your reviewers it's
ready to merge, so you get to look first and mark it ready yourself.

The description is written from the final review as an actual summary of what was built, not a link
telling the reviewer to go and read something else. When a project spans several repositories, each
pull request gets links to its siblings added, so whoever picks one up can find the rest of the
change.

If a pull request can't be opened, the run doesn't fall over — it records that it didn't happen and
carries on to the final gate, where you can open it yourself.

## Running in your own checkout instead

Sometimes a separate workspace is the wrong tool. You're already on a branch in your own checkout,
in the middle of something, and you'd rather the project just ran *there*.

If the project touches only that one repository and hasn't been set up with a workspace yet, you'll
be offered exactly that. Before you accept, it shows you what it found — the branch you're on, the
branch it plans to open the pull request against, and anything you've left uncommitted — so you're
not agreeing to something you can't see. Accept, and the project runs in your checkout on your
branch, with no separate workspace at all.

A project spanning several repositories can't do this, and says so rather than half-working. One
checkout can only ever be one repository, and the whole point of the workspace layout above is
having them together.

## Side projects: a real repository, kept local

A [side project](projects.md#standard-projects-and-side-projects) isn't backed by a registered
repository, so most of this page doesn't apply to it. It lives on its own at
`~/.radorc/side-projects/<PROJECT-NAME>/` rather than in a workspace, it never gets a worktree, and
its branch is plain `main` instead of a `radorch/` one.

What it does get is a genuine git repository — initialized for you with an opening commit, and no
remote attached. That's a deliberate choice rather than a side effect. Commits are what give your
reviews something to look at, so a side project still commits task by task and its reviewers still
get a clean per-task diff, exactly like any other project. It simply has nowhere to push and no pull
request to open, so pushes are skipped without complaint and you're never asked about auto-PR.

The practical version: you get real version history on a throwaway experiment, for free, and if it
turns into something real you have a repository to push somewhere.

## Cleaning up

Nothing deletes a workspace on your behalf. A finished project's worktrees stay on disk until you
ask for them to go — the code is still there to look at after the pull request is open, and having
it vanish on you would be worse than having to ask.

There's no command to remember. Ask your agent in plain language when you're done with one:

```
Clean up the worktrees for SEARCH-FILTERS
```

**One thing to watch.** If two projects were pointed at the same workspace, clearing it affects
both, because they're the same folders on disk. Worth checking on a series of projects where
sharing a workspace was the whole idea.

---

**Read Next:** [Projects](projects.md) · [Repository Registry](repo-registry.md) ·
[Execution Pipeline](pipeline.md) · [Configuration](configuration.md) ·
[Docs Viewer](docs-viewer.md)
