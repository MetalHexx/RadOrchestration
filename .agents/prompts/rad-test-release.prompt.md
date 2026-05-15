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

Expected: prints a version string (e.g. `1.0.0-alpha.8`) that exactly matches `package_version` in `~/.radorch/install.json` (reported in Step 8). Any mismatch indicates the bundle and the manifest are out of sync.

Verify the UI landed: `ls ~/.radorch/ui/` shows the Next.js standalone bundle (server.js or .next/static).

## Step 6 — Verify the sha256 manifest

Run the verification one-liner against the manifest file for the harness you installed:

```
node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const r=/^[a-f0-9]{64}$/;const cli=m.files.find(f=>f.bundlePath==='skills/rad-orchestration/scripts/radorch.mjs');const ui=m.files.filter(f=>f.bundlePath.startsWith('ui/')).length;const agents=m.files.filter(f=>f.bundlePath.startsWith('agents/')).length;const skills=m.files.filter(f=>f.bundlePath.startsWith('skills/')).length;const bad=m.files.filter(f=>!r.test(f.sha256||''));const noDest=m.files.filter(f=>!f.destinationPath);console.log({cli:!!cli,ui,agents,skills,badSha:bad.length,noDest:noDest.length,hasBinEntry:!!m.files.find(f=>f.bundlePath==='bin/radorch.mjs')});" {repoRoot}/manifests/{harness}/v{version}.json
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

Confirm the summary now points at the in-skill CLI path (not the retired `~/.radorch/bin/`):
- POSIX: `node $HOME/.claude/skills/rad-orchestration/scripts/radorch.mjs <subcmd>` (or the matching harness root).
- Windows: `node %USERPROFILE%\.claude\skills\rad-orchestration\scripts\radorch.mjs <subcmd>`.

Both branches must NOT mention `~/.radorch/bin/` or `setx PATH`.

## Step 8 — Report results

Report:
- Harness tested
- Versions: tarball version, ~/.radorch/install.json package_version
- Pass/fail per check
- Verbatim error output on any failure

## Step 9 — Cleanup (ask first)

Ask the user whether to keep or remove the local tarball. On yes-to-remove:

```
cd {repoRoot}/installer && Remove-Item -Force {tarball}
```

Do NOT delete `~/.radorch/projects/`.
