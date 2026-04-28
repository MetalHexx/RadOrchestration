---
description: "Test the rad-orchestration installer locally before publishing — cleans global npm, builds a local tarball, creates an ephemeral test directory inside the v3 repo (test-installer/), runs the installer with a custom orch_root (.rad), verifies the installation, and offers an interactive cleanup step."
---

# Rad Test Release

You are running a local end-to-end test of the `rad-orchestration` installer. Follow each step precisely. Do not skip steps or assume state — verify at each checkpoint.

---

## Step 1 — Clean global npm

Check for any existing global install and remove it.

```
npm list -g --depth=0
```

If `rad-orchestration` appears in the output:

```
npm uninstall -g rad-orchestration
```

Verify it is gone:

```
npm list -g --depth=0
```

> Expected: no `rad-orchestration` entry.

---

## Step 2 — Build local tarball

```
cd c:\dev\orchestration\v3\installer
npm pack
```

Note the generated filename — it will be something like `rad-orchestration-X.X.X.tgz`. You will use the full path in the next step.

---

## Step 3 — Install from tarball (simulates npx)

```
npm install -g c:\dev\orchestration\v3\installer\rad-orchestration-X.X.X.tgz
```

Replace `X.X.X` with the actual filename from Step 2.

Verify the install and discover available CLI flags:

```
radorch --version
radorch --help
```

> Expected: the version number prints without error, and `--help` outputs the full flag reference.

Read the `--help` output carefully. You will use the appropriate flags in Step 5 to run the installer non-interactively. Pay attention to the flag names for: workspace directory (`--workspace`), orchestration root (`--orch-root`), dashboard directory (`--dashboard-dir`), skip-all-prompts (`--yes`), and any others relevant to this test. If the flag names differ from what this document specifies, use whatever `--help` reports — the help output is the authoritative source.

---

## Step 4 — Create ephemeral test directory

Create a minimal project stub at `c:\dev\orchestration\v3\test-installer`. This directory sits inside the v3 repo folder for easy access and is ephemeral — it exists only for this test session. **Do not pre-create any orchestration folders** (no `.rad`, no `.github`, no `.agents`) — the installer must create them on its own.

```
mkdir c:\dev\orchestration\v3\test-installer
```

Create a minimal `package.json`:

```json
{
  "name": "test-app",
  "version": "1.0.0",
  "description": "Minimal test app for rad-orchestration installer testing"
}
```

Create a minimal `README.md`:

```
# test-app

Minimal test application for rad-orchestration installer testing.
```

> Checkpoint: `c:\dev\orchestration\v3\test-installer` exists with only `package.json` and `README.md`. No orchestration folders, no git history.

---

## Step 5 — Run installer

Using the flag names you confirmed from `radorch --help` in Step 3, run the installer non-interactively. The intent is:

- Target workspace: `c:\dev\orchestration\v3\test-installer`
- Orchestration root: `.rad` (custom, non-default)
- Dashboard directory: `c:\dev\orchestration\v3\test-installer\ui`
- Skip all interactive prompts, accepting defaults for everything not explicitly set

Based on the `--help` output, construct and run the equivalent of:

```
cd c:\dev\orchestration\v3\test-installer
radorch --yes --force --orch-root .rad --workspace c:\dev\orchestration\v3\test-installer --dashboard --dashboard-dir c:\dev\orchestration\v3\test-installer\ui
```

> `--force` is required to suppress the overwrite prompt if `.rad` already exists from a prior run. Without it, the installer exits with code 1 even when `--yes` is passed.

> If the flag names from `--help` differ from the above, use the correct names from the help output. The command above is a template — `--help` is authoritative.

> Expected: installer runs without prompts, prints a success summary, and exits with code 0.

---

## Step 6 — Verify installation

Check for each of the following. Report any missing items.

**Folder structure:**
- `c:\dev\orchestration\v3\test-installer\.rad\` exists
- `c:\dev\orchestration\v3\test-installer\.rad\agents\` exists
- `c:\dev\orchestration\v3\test-installer\.rad\skills\` exists

**Config:**
- `c:\dev\orchestration\v3\test-installer\.rad\skills\orchestration\config\orchestration.yml` exists
- Opens the file and confirms `orch_root` is set to `.rad`

**Dashboard (if installed):**
- `c:\dev\orchestration\v3\test-installer\ui\` exists with a `package.json`

---

## Step 7 — Review and cleanup

Report a summary of:
- What passed
- What failed or was missing
- The version that was tested (from Step 2)

Then use the `askQuestions` or `askUserQuestions` tool to ask the user whether they want to clean up the test directory and the installer tarball:

> "The test directory `c:\dev\orchestration\v3\test-installer` has been left intact for your inspection. Would you like to delete it now, along with the installer tarball?  Note: the installation will stay globally installed."

If the user answers **yes**, remove both:

```
Remove-Item -Recurse -Force c:\dev\orchestration\v3\test-installer
Remove-Item -Force c:\dev\orchestration\v3\installer\rad-orchestration-*.tgz
```

> The tarball is safe to delete — the global install extracts the package at install time and no longer references the file.

Confirm deletion and report that cleanup is complete.

If the user answers **no**, leave the directory intact and note its location.
