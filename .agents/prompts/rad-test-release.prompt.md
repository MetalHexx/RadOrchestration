---
description: "End-to-end test of the legacy rad-orchestration npm installer on a clean machine. Builds a tarball locally, runs the installer via npx, verifies via doctor and the sha256 manifest, and checks post-install guidance."
---

# Rad Test Release (Legacy Installer)

You are running a local end-to-end smoke of the `rad-orchestration` npm installer (the legacy install path). Follow each step precisely; verify at each checkpoint. This is the legacy-channel companion to `rad-test-plugin-release.prompt.md`.

`~/.radorch/projects/` is sacred — never delete or mutate it during this flow.

---

## What you're testing

This smoke test packs the **current state of the working tree** with whatever version is in `package.json`. It is safe to run at any point during pre-release development:

- Nothing reaches npm without a deliberate `npm publish` (auth-gated, separate flow).
- The committed catalog at `manifests/<harness>/` is protected from in-development changes — `sync-source.js`'s auto-promote step drift-warns rather than overwriting when current HEAD doesn't byte-match the committed copy.
- The runtime catalog at `installer/src/<harness>/manifests/` is local-only and ephemeral; it is regenerated on every sync-source run.

If `package.json`'s version was already published, the report's "tested version X" line refers to **current HEAD packed under the X label** — not the bytes that npm shipped as X. Version bumps happen at actual release time (`rad-release.prompt.md`), not before smoke-testing.

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

## Step 3 — Pack the installer

From `{repoRoot}/installer`, clean up any stale tarballs first, then pack:

PowerShell:
```
Remove-Item -Force *.tgz -ErrorAction SilentlyContinue
npm pack
```

POSIX:
```
rm -f ./*.tgz
npm pack
```

Record the generated tarball filename as `{tarball}`.

The `installer/package.json` `prepack` hook automatically runs `node scripts/sync-source.js` when `npm pack` fires, ensuring the bundle assets are fresh — no separate sync step needed.

> **Expect:** Cold run (fresh clone, no `cli/node_modules`, no `ui/node_modules`): 5–10 minutes. Warm run (caches populated): 1–2 minutes. If `npm pack` appears stuck for >15 minutes, suspect the ENOENT race in the UI build — investigate `ui/.next/standalone/` before retrying.

## Step 4 — Run the wizard

Stay in `{repoRoot}/installer` and invoke the installer non-interactively:

```
npx --yes ./{tarball} --yes --harness {harness}
```

> Do **not** use the absolute-path form (`npx {repoRoot}/installer/{tarball} ...`). On Windows + PowerShell, npx silently ignores absolute-path local-tarball specs and exits 0 without invoking the bin — the smoke test then reports false negatives. The `./<tarball>` form (run from `installer/`) works correctly. The first `--yes` is consumed by npx to skip its own confirmation prompt; the second `--yes` is consumed by the installer wizard.

Expected: the harness-checkbox question is bypassed by the second `--yes`; the wizard runs git/gh tooling checks — warnings appear ONLY if either tool is missing; absence of warnings is the correct outcome when both are installed; the bootstrap runs and the install completes without errors.

## Step 5 — Verify the install

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

Expected: prints a version string (e.g. `1.0.0-alpha.8`) that exactly matches `harnesses.{harness}.version` in `~/.radorch/install.json` (reported in Step 8). Any mismatch indicates the bundle and the manifest are out of sync.

Verify the UI landed: `ls ~/.radorch/ui/` shows the Next.js standalone bundle (server.js or .next/static).

## Step 6 — Verify the sha256 manifest

Run the verification one-liner against the **runtime catalog** — the manifest that `npm pack` just regenerated and is about to ship inside the tarball. This is **not** the committed catalog at `<repoRoot>/manifests/<harness>/v<version>.json`; that one is the historical record of what was tagged at release time and is intentionally not regenerated by `sync-source.js` for already-released versions (the auto-promote step drift-warns instead of overwriting). Smoke validation needs the runtime location:

```
node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const r=/^[a-f0-9]{64}$/;const cli=m.files.find(f=>f.bundlePath==='skills/rad-orchestration/scripts/radorch.mjs');const ui=m.files.filter(f=>f.bundlePath.startsWith('ui/')).length;const agents=m.files.filter(f=>f.bundlePath.startsWith('agents/')).length;const skills=m.files.filter(f=>f.bundlePath.startsWith('skills/')).length;const bad=m.files.filter(f=>!r.test(f.sha256||''));const noDest=m.files.filter(f=>!f.destinationPath);console.log({cli:!!cli,ui,agents,skills,badSha:bad.length,noDest:noDest.length,hasBinEntry:!!m.files.find(f=>f.bundlePath==='bin/radorch.mjs')});" {repoRoot}/installer/src/{harness}/manifests/v{version}.json
```

Expected output (all these must be true):
- `cli: true` — the radorch.mjs bundle is present
- `ui: [number > 0]` — UI files are included
- `agents: [number > 0]` — agent files are included
- `skills: [number > 0]` — skill files are included
- `badSha: 0` — all entries have valid 64-char sha256 hashes
- `noDest: 0` — all entries have `destinationPath` fields
- `hasBinEntry: false` — the retired `bin/radorch.mjs` entry is absent

## Step 7 — Verify the post-install guidance

Confirm the "What's Next" block in the installer's terminal output shows the in-harness orchestration workflow (the prior CLI-direct-invoke guidance was retired):

The output must contain, in this order:
- `/rad-brainstorm` (refine a project idea)
- `/rad-plan` (produce requirements + master plan)
- `/rad-execute` (run the pipeline through implementation)

The output must NOT contain: `radorch.mjs`, `%USERPROFILE%`, `$HOME`, `~/.radorch/bin/`, or `setx PATH`.

If the `claude` harness was installed, `/rad-ui-start` also appears as an optional dashboard step.

## Step 8 — Report results

Report:
- Harness tested
- Versions: tarball version, `~/.radorch/install.json` `harnesses.{harness}.version`
- Pass/fail per check
- Verbatim error output on any failure

## Step 9 — Cleanup (ask first)

Ask the user whether to keep or remove the local tarball. On yes-to-remove:

```
cd {repoRoot}/installer && Remove-Item -Force {tarball}
```

Do NOT delete `~/.radorch/projects/`.
