---
description: "End-to-end test of the legacy rad-orchestration npm installer on a clean machine. Builds a tarball locally, installs it globally, runs the wizard, bootstraps, verifies the install via radorch doctor and the sha256 manifest, and checks the post-install PATH guidance works."
---

# Rad Test Release (Legacy Installer)

You are running a local end-to-end smoke of the `rad-orchestration` npm installer (the legacy install path). Follow each step precisely; verify at each checkpoint. This is the legacy-channel companion to `rad-test-plugin-release.prompt.md`.

`~/.radorch/projects/` is sacred — never delete or mutate it during this flow.

---

## Step 1 — Pick a harness

Use `AskUserQuestion` (or the harness-equivalent) to ask which harness to test:

| Label | Value |
|-------|-------|
| Claude Code | `claude` |
| GitHub Copilot in VS Code | `copilot-vscode` |
| GitHub Copilot CLI | `copilot-cli` |

Record the answer as `{harness}`.

## Step 2 — Resolve repo root

`git rev-parse --show-toplevel` from anywhere inside this repo; record as `{repoRoot}`.

## Step 3 — Remove any prior global install

`npm list -g --depth=0`; if `rad-orchestration` appears, `npm uninstall -g rad-orchestration`. Verify removal with another `npm list -g`. Leave `~/.radorch/projects/` entirely intact.

## Step 4 — Build adapter sources and emit shared assets

From `{repoRoot}`:

```
npm run build:{harness}
cd installer && node scripts/sync-source.js
```

`sync-source.js` emits the shared `installer/src/ui/` once, then emits the CLI bundle per-harness into `installer/src/{harness}/skills/rad-orchestration/scripts/radorch.mjs` and augments every per-harness manifest with the corresponding entries.

## Step 5 — Pack the installer

```
cd {repoRoot}/installer && npm pack
```

Record the generated tarball filename as `{tarball}`.

## Step 6 — Install globally from the tarball

```
npm install -g {repoRoot}/installer/{tarball}
radorch --version
```

## Step 7 — Run the wizard non-interactively

```
radorch --yes --harness {harness}
```

> Expected: a single harness-checkbox question is bypassed by `--yes`; the wizard prints unconditional git/gh tooling-check warnings (FR-17) and runs the bootstrap; the install completes without errors.

## Step 8 — Verify the install

Run `radorch doctor`. Expected: all checks pass.

Verify the CLI landed inside the rad-orchestration skill (the harness root is `~/.claude` for `claude`, `~/.copilot` for the Copilot harnesses):
- POSIX: `test -x ~/{harnessRoot}/skills/rad-orchestration/scripts/radorch.mjs && wc -c ~/{harnessRoot}/skills/rad-orchestration/scripts/radorch.mjs` — file is non-empty and executable.
- Windows: confirm `%USERPROFILE%\{harnessRoot}\skills\rad-orchestration\scripts\radorch.mjs` exists and is non-empty.

Verify the UI landed: `ls ~/.radorch/ui/` shows the Next.js standalone bundle (server.js or .next/static).

Verify projects survived: `ls ~/.radorch/projects/` matches its pre-install contents byte-for-byte.

## Step 9 — Verify the sha256 manifest

Open `{repoRoot}/installer/src/{bundleDir}/manifests/v{version}.json` (`bundleDir` matches the harness — `claude`, `copilot-vscode`, or `copilot-cli`). Confirm: the CLI entry `skills/rad-orchestration/scripts/radorch.mjs` is present, plus `ui/**`, `agents/*`, and `skills/*` entries; the three resurrected `rad-ui-*` skills appear under `skills/`; every entry carries a 64-char `sha256` field; and no `bin/radorch.mjs` entry remains.

## Step 10 — Verify the post-install guidance

Confirm the summary now points at the in-skill CLI path (not the retired `~/.radorch/bin/`):
- POSIX: `node $HOME/.claude/skills/rad-orchestration/scripts/radorch.mjs <subcmd>` (or the matching harness root).
- Windows: `node %USERPROFILE%\.claude\skills\rad-orchestration\scripts\radorch.mjs <subcmd>` plus the `npm install -g rad-orchestration` alternative.

Both branches must NOT mention `~/.radorch/bin/` or `setx PATH`.

## Step 11 — Report results

Report:
- Harness tested
- Versions: tarball version, radorch --version, ~/.radorch/install.json package_version
- Pass/fail per check
- Verbatim error output on any failure

## Step 12 — Cleanup (ask first)

Ask the user whether to keep or remove the local tarball and the global install. On yes-to-remove:

```
npm uninstall -g rad-orchestration
cd {repoRoot}/installer && Remove-Item -Force {tarball}
```

Do NOT delete `~/.radorch/projects/`.
