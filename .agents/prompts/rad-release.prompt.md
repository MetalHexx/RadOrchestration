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
   - `cli/package.json`
   - `plugin/package.json`
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

### 3a — Bump versions, build catalogs, validate, then commit (one tagged unit of work)

The version bump, the per-harness manifest catalog generation, and the plugin tree validation **must all land in a single commit**. The committed manifest catalog at `manifests/<harness>/v<version>.json` is the source of truth for what shipped at this version — if the bump commit doesn't include the new manifest files, the catalog never grows in HEAD and the installer's upgrade-cleanup contract breaks for users on this version going forward.

Run the steps below in order. **Do not commit until step 5.**

1. **Bump versions in all five package.json files.** Set `"version"` to the confirmed version number in:
   - `installer/package.json`
   - `ui/package.json`
   - `skills/rad-orchestration/scripts/package.json`
   - `cli/package.json`
   - `plugin/package.json`

   Note: `package_version` inside each per-harness bundle's `orchestration.yml` (e.g., `installer/src/claude/skills/rad-orchestration/config/orchestration.yml`) is **auto-stamped at build time** from `installer/package.json`. Do not edit it manually.

2. **Generate the per-harness manifest catalog for the new version.** From the repo root:

   ```
   node installer/scripts/sync-source.js --promote
   ```

   The `--promote` flag tells sync-source to write the freshly-emitted manifest into the committed catalog at `manifests/<harness>/v<version>.json` (the "case 1 → write" branch of autoPromoteCommittedManifest). Without the flag, sync-source emits only the runtime catalog and skips committed writes — that's the default behavior used by smoke tests and dev iteration, so they never pollute the committed source of truth.

   This runs `emitBundles` for every adapter. Its `autoPromoteCommittedManifest` step writes a new `manifests/<harness>/v{version}.json` file for each harness (the file doesn't exist yet for the new version, so the "case 1 → write" branch fires). After this step, three new committed-catalog files exist on disk and are flagged as untracked by `git status`.

3. **Build the plugin tree end-to-end.** From the repo root:

   ```
   npm run build:plugin
   ```

   This validates `cli/dist/marketplaces/claude/plugins/rad-orchestration/` — agent files, skill files, manifests/v{version}.json, hooks, UI standalone bundle. The validate-plugin-tree step fails fast on missing artifacts.

4. **Plugin tarball size budget check.**

   ```
   cd cli/dist/marketplaces/claude/plugins/rad-orchestration
   npm pack --dry-run --json
   ```

   Confirm the reported `unpackedSize` is under **57,671,680 bytes** (50 MB ceiling + 10% headroom). If size has grown past that, audit the included assets — do not raise the budget without an explicit decision.

   If any step above fails, **do not commit yet**. Fix locally; re-run from step 2.

5. **Stage and commit — version bumps and new manifest catalog entries land together.**

   ```
   git add installer/package.json ui/package.json skills/rad-orchestration/scripts/package.json cli/package.json plugin/package.json
   git add manifests/claude/v{version}.json manifests/copilot-cli/v{version}.json manifests/copilot-vscode/v{version}.json
   git commit -m "chore: bump version to {version}"
   ```

### 3a.5 — Reproducibility assertion (always, regardless of merge choice)

After the bump commit, re-run the build pipeline and assert the working tree stays clean. A dirty tree means the build is non-deterministic and the committed manifest would falsify what CI eventually ships — block the tag in that case until the non-determinism is resolved.

From the repo root:

```
node installer/scripts/sync-source.js --promote
npm run build:plugin
git status --porcelain
```

The expected output of `git status --porcelain` is **empty**. If anything appears:

- A new or modified `manifests/<harness>/v{version}.json` means `autoPromoteCommittedManifest` fired the `'drift-warned'` branch on the second run — the canonical sources don't reproduce byte-identical sha256s across runs (typically a line-ending issue, a non-deterministic build input, or a stale dependency).
- Any other dirty path means an asset emitter is non-deterministic.

Do not push the tag until the working tree is clean on a second pass. Investigate the drift, fix the root cause, re-run from step 3a, and re-verify this assertion.

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

### 3d — Publish jobs

Once the `v*` tag is pushed to the remote, two GitHub Actions jobs fire automatically in the `.github/workflows/publish.yml` workflow: the legacy `publish` job and the new `publish-plugin` job. Both run in lockstep with no further operator action needed. The `publish` job builds and publishes the core packages to npm; the `publish-plugin` job validates and publishes the Claude plugin to the plugin marketplace. You can monitor both in the [Actions tab](https://github.com/MetalHexx/RadOrchestration/actions).

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

For the **first release of a plugin version** (and at the GA boundary), include a `### Claude Code plugin install` callout in the `## What's New` section:

> Claude Code users can now install via the marketplace:
>
> ```
> /plugin install rad-orchestration
> ```
>
> The plugin install includes the orchestration runtime, the dashboard UI, and three UI-control skills (`rad-ui-start`, `rad-ui-stop`, `rad-ui-status`). Existing `npx rad-orchestration` users keep their current setup; both channels remain supported.

Skip the callout in patch releases that don't change the install experience.

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
