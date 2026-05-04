---
description: "Test the rad-orchestration installer locally before publishing — cleans global npm, builds a local tarball, creates an ephemeral test directory inside the repo (test-installer/), runs the installer with a custom orch_root (.rad), verifies the installation, and offers an interactive cleanup step."
---

# Rad Test Release

You are running a local end-to-end test of the `rad-orchestration` installer. Follow each step precisely. Do not skip steps or assume state — verify at each checkpoint.

---

## Step 0 — Select harness

**CRITICAL: Use the `vscode_askQuestions` tool for this step.**

Ask the user which AI harness to test:

> "Which harness do you want to test?"

Options: `claude-code` / `copilot-vscode` / `copilot-cli`

Record the answer as `{harness}`. Use it wherever `{harness}` appears in the steps below.

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
cd c:\dev\src\RadOrchestration\installer
npm pack
```

Note the generated filename — it will be something like `rad-orchestration-X.X.X.tgz`. You will use the full path in the next step.

---

## Step 3 — Install from tarball (simulates npx)

```
npm install -g c:\dev\src\RadOrchestration\installer\rad-orchestration-X.X.X.tgz
```

Replace `X.X.X` with the actual filename from Step 2.

Verify the install and discover available CLI flags:

```
radorch --version
radorch --help
```

> Expected: the version number prints without error, and `--help` outputs the full flag reference.

Read the `--help` output carefully. You will use the appropriate flags in Step 5 to run the installer non-interactively. Pay attention to the flag names for: AI harness (`--tool`), workspace directory (`--workspace`), orchestration root (`--orch-root`), dashboard directory (`--dashboard-dir`), skip-all-prompts (`--yes`), and any others relevant to this test. If the flag names differ from what this document specifies, use whatever `--help` reports — the help output is the authoritative source.

---

## Step 4 — Create ephemeral test directory

Create a minimal project stub at `c:\dev\src\RadOrchestration\test-installer`. This directory sits inside the repo root for easy access and is gitignored — it exists only for this test session. **Do not pre-create any orchestration folders** (no `.rad`, no `.github`, no `.agents`) — the installer must create them on its own.

```
mkdir c:\dev\src\RadOrchestration\test-installer
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

> Checkpoint: `c:\dev\src\RadOrchestration\test-installer` exists with only `package.json` and `README.md`. No orchestration folders, no git history.

---

## Step 5 — Run installer

Using the flag names you confirmed from `radorch --help` in Step 3, run the installer non-interactively. The intent is:

- AI harness: `{harness}` (chosen in Step 0)
- Target workspace: `c:\dev\src\RadOrchestration\test-installer`
- Orchestration root: `.rad` (custom, non-default)
- Dashboard directory: `c:\dev\src\RadOrchestration\test-installer\ui`
- Skip all interactive prompts, accepting defaults for everything not explicitly set

Based on the `--help` output, construct and run the equivalent of:

```
cd c:\dev\src\RadOrchestration\test-installer
radorch --yes --tool {harness} --orch-root .rad --workspace c:\dev\src\RadOrchestration\test-installer --dashboard --dashboard-dir c:\dev\src\RadOrchestration\test-installer\ui
```

> `--tool` selects the AI harness whose bundle is installed (`claude-code`, `copilot-vscode`, or `copilot-cli`). This is required — `--yes` does not auto-select a harness.

> Modified-file detect-and-warn is unconditional and cannot be bypassed. If the installer prompts about locally-modified files (e.g., on a repeat run), that is expected — respond interactively. There is no `--force` escape hatch.

> If the flag names from `--help` differ from the above, use the correct names from the help output. The command above is a template — `--help` is authoritative.

> Expected: installer runs without prompts, prints a success summary, and exits with code 0.

---

## Step 6 — Verify installation

Check for each of the following. Report any missing items.

**Folder structure:**
- `c:\dev\src\RadOrchestration\test-installer\.rad\` exists
- `c:\dev\src\RadOrchestration\test-installer\.rad\agents\` exists
- `c:\dev\src\RadOrchestration\test-installer\.rad\skills\` exists

**Config:**
- `c:\dev\src\RadOrchestration\test-installer\.rad\skills\rad-orchestration\config\orchestration.yml` exists
- Open the file and confirm:
  - `system.orch_root` is set to `.rad`
  - A top-level `package_version` field is present and matches the version from Step 2

**Dashboard (if installed):**
- `c:\dev\src\RadOrchestration\test-installer\ui\` exists with a `package.json`

**Manifest catalog (new in MULTI-HARNESS-2):**

Note: the manifest directory name uses the adapter's internal name, which differs from the `--tool` value for one harness:

| `--tool` value | Manifest directory |
|---|---|
| `claude-code` | `installer\src\claude\manifests\` |
| `copilot-vscode` | `installer\src\copilot-vscode\manifests\` |
| `copilot-cli` | `installer\src\copilot-cli\manifests\` |

Using the correct directory for `{harness}` from the table above:

- The manifests directory exists
- A file named `v<version>.json` (matching the version from Step 2) exists in that directory
- Open the manifest and confirm each file entry contains a `sha256` field

> Note: manifests are always generated during `npm pack` (Step 2) via the `prepack` lifecycle hook. They are guaranteed to be present after Step 2 completes.

---

## Step 7 — Review and cleanup

Report a summary of:
- What passed
- What failed or was missing
- The version that was tested (from Step 2)

Then use the `vscode_askQuestions` tool to ask the user whether they want to clean up the test directory and the installer tarball:

> "The test directory `c:\dev\src\RadOrchestration\test-installer` has been left intact for your inspection. Would you like to delete it now, along with the installer tarball? Note: the global installation will stay installed."

If the user answers **yes**, remove both:

```
Remove-Item -Recurse -Force c:\dev\src\RadOrchestration\test-installer
Remove-Item -Force c:\dev\src\RadOrchestration\installer\rad-orchestration-*.tgz
```

> The tarball is safe to delete — the global install extracts the package at install time and no longer references the file.

Confirm deletion and report that cleanup is complete.

If the user answers **no**, leave the directory intact and note its location (`c:\dev\src\RadOrchestration\test-installer`).
