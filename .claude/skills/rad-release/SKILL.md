---
name: rad-release
description: Drive the end-to-end release flow locally — context, version bump, build, validate, commit, publish, sync, tag, and post-release dev bump.
---

## Step 1 — Gather context

Run `node .claude/skills/rad-release/scripts/gather-context.mjs` from the repo root. This module reads the current version from `cli/package.json`, resolves the active branch via `git branch --show-current`, determines whether the working tree is dirty via `git status --porcelain`, and attempts to locate the most recent `v*` release tag via `git describe --tags --abbrev=0 --match "v*"` (returns `null` when no matching tag exists yet — expected on first release). Print the four-field result for operator awareness before proceeding. (FR-10 step 1)

## Step 2 — Up-front questions

Using the harness question tool (`AskUserQuestion` on Claude Code), present the operator with two decisions before any mutation occurs:

1. **Target version** — show the `currentVersion` gathered in step 1 and the `lastReleaseTag` (or "none yet" when `null`). Suggest the next version: if `currentVersion` is a pre-release (`-alpha.N` / `-beta.N`), suggest bumping the pre-release counter; if stable, suggest a patch bump. Ask the operator to confirm or supply a different target.

2. **Merge to main** — if `currentBranch` is not `main`, ask whether the operator wants to squash-merge to `main` after the release commit lands (step 8). This is the first of two mid-flow approval gates; the second is CHANGELOG approval in step 5 (DD-1). No other pause points exist.

Both answers are carried forward into subsequent gates. (FR-10 step 2, DD-1)

## Step 3 — Lockstep version bump

Invoke `node .claude/skills/rad-release/scripts/bump-version.mjs --to <new>` where `<new>` is the target version confirmed in step 2. This performs the AD-3 lockstep bump across all carrier locations: wrapper `package.json` files, plugin authoritative version sources, per-version manifest catalog file renames (with internal `version` field updated), and a hardcoded-literal sweep. A final re-grep halts loudly if any stray copy of the prior version remains after the sweep. (FR-10 step 3, added in P03-T02)

## Step 4 — Build + validate

## Step 5 — CHANGELOG draft + approval gate

## Step 6 — Single commit

## Step 7 — Reproducibility assertion

## Step 8 — Squash-merge to main

## Step 9 — Publish standard installer to npm

## Step 10 — Sync built plugin artifacts into satellite

## Step 11 — Tag and push

## Step 12 — Generate workspace-local release notes

## Step 13 — Post-release in-tree dev bump
