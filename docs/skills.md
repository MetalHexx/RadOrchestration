# Slash Commands

This page documents the user-invoked slash commands for the orchestration system. Author-time and plumbing skills — the internal skills that pipeline agents load automatically — are intentionally not listed here. Operators interact with the system through these six commands; everything else runs behind the scenes.

### /rad-brainstorm

**What it does** — Runs a collaborative ideation session to align goals and capture context before planning begins.

**When to use it** — Use it before non-trivial work to decide whether the work warrants a project series and to gather linked PRDs, design docs, or screenshots that the planners will read.

**What it produces** — `{NAME}-BRAINSTORMING.md` at the project root.

### /rad-plan

**What it does** — Starts the full planning pipeline using the `default` template — suited for mission-critical or large projects.

**When to use it** — Use it after `/rad-brainstorm`, or when you already have planning context and want the complete ceremony: per-task code review, per-task gate, phase review, phase gate, audit pass, plan approval gate, final review, and final approval gate.

**What it produces** — `{NAME}-REQUIREMENTS.md`, `{NAME}-MASTER-PLAN.md`, and the per-phase and per-task files under `phases/` and `tasks/`.

### /rad-plan-quick

**What it does** — Runs the same planning and approval ceremony as `/rad-plan` using the `quick` template, with Extra Large task size hardcoded.

**When to use it** — Use it when the work is small enough that per-task code review and per-phase review would be ceremony; the plan approval gate and final approval gate are still preserved.

**What it produces** — The same planning documents as `/rad-plan`.

### /rad-execute

**What it does** — Runs the approved plan in your current branch and worktree.

**When to use it** — Use it after the plan is approved and you want execution in place without switching branches.

**What it produces** — No document; runs the next pipeline tier.

### /rad-execute-parallel

**What it does** — Runs the approved plan in a dedicated worktree and branch.

**When to use it** — Use it when you want `main` untouched during execution, or when you want to run multiple projects in parallel.

**What it produces** — No document; runs the next pipeline tier.

### /rad-configure-system

**What it does** — Walks you through editing `orchestration.yml` to set pipeline limits, gate modes, and source-control modes.

**When to use it** — Use it on first install or whenever you want to change the system-wide defaults.

**What it produces** — Edits to `orchestration.yml`.
