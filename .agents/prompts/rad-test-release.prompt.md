---
description: "End-to-end test of the legacy rad-orchestration npm installer on a clean machine. Builds a tarball locally, runs the installer via npx, verifies via doctor and the sha256 manifest, and checks post-install guidance."
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

## Step 3 — Sync installer bundle assets

From `{repoRoot}`:

```
cd installer && node scripts/sync-source.js
```

Do **not** run `npm run build:{harness}` here — that would deploy agents/skills directly to `~/.claude/` or `~/.copilot/` and pre-pollute the destination before the installer runs, defeating the purpose of the cold-install test. `sync-source.js` already runs the adapters fresh into `installer/src/<harness>/` on its own.

`sync-source.js` ensures `cli/node_modules/` and `cli/dist/` are populated (running `npm ci && npm run build` in `cli/` if missing — no manual prereq), emits the shared `installer/src/ui/` once, emits the CLI bundle per-harness into `installer/src/{harness}/skills/rad-orchestration/scripts/radorch.mjs`, and augments every per-harness manifest with the corresponding entries (including `destinationPath`, which the installer expands at install time).

## Step 4 — Pack the installer

```
cd {repoRoot}/installer && npm pack
```

Record the generated tarball filename as `{tarball}`.

## Step 5 — Verify the tarball

Stay in `{repoRoot}/installer` (Step 4 already `cd`'d there) and invoke the tarball by relative path:

```
npx ./{tarball} --version
```

> Do **not** use the absolute-path form (`npx {repoRoot}/installer/{tarball} ...`). On Windows + PowerShell, npx silently ignores absolute-path local-tarball specs and exits 0 without invoking the bin — the smoke test then reports false negatives. The `./<tarball>` form (run from `installer/`) works correctly.

## Step 6 — Run the wizard non-interactively

Still from `{repoRoot}/installer`:

```
npx ./{tarball} --yes --harness {harness}
```

Same npx-absolute-path caveat as Step 5 applies.

> Expected: a single harness-checkbox question is bypassed by `--yes`; the wizard runs git/gh tooling checks (FR-17) — warnings appear ONLY if either tool is missing; absence of warnings is the correct outcome when both are installed; the bootstrap runs and the install completes without errors.

## Step 7 — Verify the install

Health checks have moved to the in-skill CLI. Run:
- POSIX: `node $HOME/{harnessRoot}/skills/rad-orchestration/scripts/radorch.mjs doctor`
- Windows: `node %USERPROFILE%\{harnessRoot}\skills\rad-orchestration\scripts\radorch.mjs doctor`

Expected: all checks pass.

Verify the CLI landed inside the rad-orchestration skill (the harness root is `~/.claude` for `claude`, `~/.copilot` for the Copilot harnesses):
- POSIX: `test -x ~/{harnessRoot}/skills/rad-orchestration/scripts/radorch.mjs && wc -c ~/{harnessRoot}/skills/rad-orchestration/scripts/radorch.mjs` — file is non-empty and executable.
- Windows: confirm `%USERPROFILE%\{harnessRoot}\skills\rad-orchestration\scripts\radorch.mjs` exists and is non-empty.

Verify the in-skill CLI reports a version that matches the installer:
- POSIX: `node $HOME/{harnessRoot}/skills/rad-orchestration/scripts/radorch.mjs --version`
- Windows: `node %USERPROFILE%\{harnessRoot}\skills\rad-orchestration\scripts\radorch.mjs --version`

Expected: prints a version string (e.g. `1.0.0-alpha.8`) that exactly matches `package_version` in `~/.radorch/install.json` (recorded in Step 10). Any mismatch indicates the bundle and the manifest are out of sync.

Verify the UI landed: `ls ~/.radorch/ui/` shows the Next.js standalone bundle (server.js or .next/static).

## Step 8 — Verify the sha256 manifest

Open `{repoRoot}/installer/src/{bundleDir}/manifests/v{version}.json` (`bundleDir` matches the harness — `claude`, `copilot-vscode`, or `copilot-cli`). Each manifest entry carries `bundlePath`, `sourcePath`, `destinationPath`, `sha256`, `ownership`, `version`, and `harness`. There is no `path` field — use `bundlePath` for in-bundle relative paths.

Confirm:

- A `bundlePath` entry equal to `skills/rad-orchestration/scripts/radorch.mjs` is present.
- `bundlePath` entries under `ui/**`, `agents/*`, and `skills/*` are present.
- The three `rad-ui-*` skills appear under `skills/`.
- **Every entry carries a 64-char `sha256` field.**
- **Every entry carries a `destinationPath` field templated with `${HARNESS_ROOT}/...` (for `agents/` and `skills/`) or `${RAD_HOME}/...` (for everything else).** This is the routing-as-data contract both the installer and the in-skill CLI consume.
- No `bin/radorch.mjs` entry remains.

## Step 9 — Verify the post-install guidance

Confirm the summary now points at the in-skill CLI path (not the retired `~/.radorch/bin/`):
- POSIX: `node $HOME/.claude/skills/rad-orchestration/scripts/radorch.mjs <subcmd>` (or the matching harness root).
- Windows: `node %USERPROFILE%\.claude\skills\rad-orchestration\scripts\radorch.mjs <subcmd>`.

Both branches must NOT mention `~/.radorch/bin/` or `setx PATH`.

## Step 10 — Report results

Report:
- Harness tested
- Versions: tarball version, `npx {tarball} --version`, ~/.radorch/install.json package_version
- Pass/fail per check
- Verbatim error output on any failure

## Step 11 — Cleanup (ask first)

Ask the user whether to keep or remove the local tarball. On yes-to-remove:

```
cd {repoRoot}/installer && Remove-Item -Force {tarball}
```

Do NOT delete `~/.radorch/projects/`.
