# Slash Commands

This page documents the user-invoked slash commands for the orchestration system. Author-time and plumbing skills — the internal skills that pipeline agents load automatically — are intentionally not listed here. Operators interact with the system through these six commands; everything else runs behind the scenes.

The 3 most important commands are: `/rad-brainstorm`,  `/rad-plan` and `/rad-execute`.  The others are for special cases and convenience.

The shipped review-intensity tiers are `extra-high`, `high`, `medium`, and `low`. They share planning ceremony and final review; they differ only in defensive review depth between planning and final approval. See [Process Templates](pipeline.md#process-templates) for the full matrix.

### /rad-brainstorm

**What it does** — Runs a collaborative ideation session to align goals and capture context before planning begins.

**When to use it** — Use it before non-trivial work to decide whether the work warrants a project series and to gather linked PRDs, design docs, or screenshots that the planners will read.  It is highly recommended you start every project with a brainstorming session.  It's not required, but it will greatly help you align your intent to produce the best possible planning documents when running `/rad-plan` later.

**What it produces** — `{NAME}-BRAINSTORMING.md` at the project root.  This will be linked to a project series (should you choose to create one).  Relevant docs and additional context will be linked to the brainstorming document and read by the Planner when it authors `{NAME}-REQUIREMENTS.md`.

### /rad-plan

**What it does** — Starts the full planning pipeline. At the start, you pick a review-intensity tier (`extra-high`, `high`, `medium`, `low`) and a Project Size (`Small`, `Medium`, `Large`, `Extra Large`, or `Custom` prose). The planners then produce a requirements document and an execution plan. If you already have a brainstorming document, your planners will automatically use it to create the formal plans.

The tier governs review depth — `extra-high` runs per-task code review plus phase review plus final review; `low` runs final review only; `high` and `medium` are intermediate. Project Size governs task scope and phase scope, with a `(Recommended)` size that moves with the chosen tier.

**When to use it** — Use it after `/rad-brainstorm`, or when you already have planning context and want planning ceremony plus the review depth your project needs.

**How to use it** Typically you type `/rad-plan <PROJECT-NAME>` if you've created a brainstorming document prior.  However, if you have no brainstorming document, you can enter as long of a prompt as you want along with links to any additional documents, resources, images that you want the planners to consider in the final plan.

**What it produces** — `{NAME}-REQUIREMENTS.md`, `{NAME}-MASTER-PLAN.md`, and the per-phase and per-task files under `phases/` and `tasks/`.

### /rad-execute

**What it does** — Runs the approved plan in your current branch and worktree.  This will begin the coding and code review process, so be sure you've thoroughly read your plans before you use this command.

**When to use it** — Use it after the plan is approved and you want execution in place without switching branches.

**How to use it** - `/rad-execute <PROJECT-NAME>`.  If you don't provide a project name, you will be prompted to select a project.  You must make sure you've already created a plan with `/rad-plan` as a prerequisite to using this command.

**What it produces** — Your final code output.  During the process, you will also see code review documents as you iterate through phases and tasks.

### /rad-execute-parallel

**What it does** — Runs the approved plan in a dedicated worktree and branch.

**When to use it** — Use it when you want `main` untouched during execution, or when you want to run multiple projects in parallel.  Effectively, this will create a copy of your repository into a new directory in a new branch based on the branch you choose.

**What it produces** — Nothing is really produced in this command other than the new worktree where `/rad-execute` will be run.

### /rad-configure-system

**What it does** — Walks you through editing `orchestration.yml` to set pipeline limits, gate modes, and source-control modes.

**When to use it** — Use it on first install or whenever you want to change the system-wide defaults.

**What it produces** — Edits to `orchestration.yml`.
