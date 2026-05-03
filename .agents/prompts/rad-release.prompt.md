---
description: "Run the full release process — version bump, optional merge to main, tag, push, and generate release notes."
---

# Rad Release

You are running the release process for the `rad-orchestration` package. Follow each step precisely. **You must use the `vscode_askQuestions` tool to ask ALL questions before taking any action.** Never assume answers — always ask first.

---

## Step 1 — Gather context (read-only, no changes yet)

Run the following commands to collect the information you'll need for the questions:

1. `git branch --show-current` — current branch name
2. `git status --short` — any uncommitted changes
3. Read current versions from these files (all must be bumped in lockstep):
   - `installer/package.json` (authoritative — drives the suggested next version)
   - `ui/package.json`
   - `skills/rad-orchestration/scripts/package.json`
4. Read `CHANGELOG.md` at the repo root if it exists (will be created on first release)

---

## Step 2 — Ask all questions upfront using `vscode_askQuestions`

**CRITICAL: Use the `vscode_askQuestions` tool for this step. Do not ask questions in plain text.**

Compose a single `vscode_askQuestions` call with the following questions:

### Question 1 — Version number

Based on the current version in `installer/package.json`, suggest the next logical version using these rules:
- If the current version is a pre-release (e.g., `1.0.0-alpha.2`), suggest incrementing the pre-release number (e.g., `1.0.0-alpha.3`)
- If the current version is a stable release (e.g., `1.2.0`), suggest a patch bump (e.g., `1.2.1`)

Ask: _"What version should this release be tagged as? (current: `{current_version}`, suggested: `{suggested_version}`)"_

Allow the user to accept the suggestion or type a custom version.

### Question 2 — Merge to main (only include this if NOT currently on `main`)

If the current branch is not `main`, ask:
_"You are on branch `{branch}`. Should this branch be squash-merged to main before tagging?"_

Options: `Yes, squash merge to main` / `No, tag from this branch`

---

## Step 3 — Execute based on answers

**Follow this order exactly. The version bump always happens on the working branch before any merge.**

### 3a — Update the version (always first, before any merge)

Edit each of these files — set `"version"` to the confirmed version number. All three must carry the same version:
- `installer/package.json`
- `ui/package.json`
- `skills/rad-orchestration/scripts/package.json`

Note: `package_version` inside each per-harness bundle's `orchestration.yml` (e.g., `installer/src/claude/skills/rad-orchestration/config/orchestration.yml`) is **auto-stamped at build time** by the contributor build / publish step from `installer/package.json`. Do not edit it manually as part of the release flow.

Stage and commit the version bump on the current branch:

```
git add installer/package.json ui/package.json skills/rad-orchestration/scripts/package.json
git commit -m "chore: bump version to {version}"
```

### 3b — Merge to main (only if the user chose to merge)

Now that the version bump is committed on this branch, squash-merge the entire branch into main:

1. Analyze the changes to produce a concise squash merge commit message:
   - Run `git log main..HEAD --oneline` to see all commits on this branch (including the version bump just made)
   - Run `git diff main --stat` to see which files changed
   - Read the most significant changed files to understand what changed
   - Write a commit message that is:
     - A short one-line summary as the subject (e.g., `feat: add absolute path support and installer improvements`)
     - Followed by a blank line
     - Followed by a tight bullet list of the key changes — keep it high-level unless a change is purely technical with no user-visible effect
     - No implementation details, no function names, no file names in the bullet list unless they are central to understanding the change
     - Do **not** include the version bump itself as a bullet — it is implied by the tag
2. Run: `git checkout main && git merge --squash {branch} && git commit -m "{message}"`

### 3c — Tag and push

```
git tag v{version}
git push origin main
git push origin v{version}
```

> If the user chose **not** to merge to main, skip step 3b and push the current branch + the tag:
> ```
> git tag v{version}
> git push origin {branch}
> git push origin v{version}
> ```

---

## Step 4 — Generate release notes

Create a file named `RELEASE-NOTES-v{version}.md` in the root of the `v3/` workspace folder (`c:\dev\orchestration\v3\`).

The release notes should be:
- **User-friendly** — written for someone who uses the tool, not someone who wrote it
- **High-level** — describe what changed from the user's perspective, not how it was implemented
- **Only technical** for changes that are entirely internal with no user-visible behavior (e.g., test coverage additions)
- Structured with a `## What's New`, `## What's Fixed`, or `## Changes` section as appropriate — only include sections that have content
- End with a `## Package` table containing: package name, npm version, registry URL, and tag

To write accurate release notes:
- Use the squash merge commit message body as a starting point
- Cross-reference the actual diff (`git diff {previous_tag}..v{version} --stat`) to make sure nothing significant is missed
- Find the previous tag with `git tag --sort=-creatordate | head -5`

---

## Step 5 — Update `CHANGELOG.md`

Maintain a cumulative `CHANGELOG.md` at the repo root alongside the per-release notes file.

**If `CHANGELOG.md` does not yet exist**, create it with this header:

```markdown
# Changelog

All notable changes to this project are documented here. For full per-release detail, see the `RELEASE-NOTES-v*.md` files or the [GitHub Releases page](https://github.com/MetalHexx/RadOrchestration/releases).
```

**Prepend a new section for this release** (after the header, before any prior entries):

```markdown
## v{version} — {YYYY-MM-DD}

{same body content as RELEASE-NOTES-v{version}.md, minus the `## Package` table}
```

Commit the CHANGELOG update and push:

```
git add CHANGELOG.md RELEASE-NOTES-v{version}.md
git commit -m "docs: add changelog entry for v{version}"
git push origin {branch}
```

> Note: this commit lands **after** the tag, so the tag itself will not contain the CHANGELOG entry. That's intentional — release notes are authored post-tag, and this keeps the commit-that-gets-tagged minimal.
