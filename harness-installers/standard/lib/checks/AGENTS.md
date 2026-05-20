# Tooling Pre-flight Checks

## Purpose

Install-time checks that verify tooling availability before the wizard begins collecting configuration. The module exports functions that test for `git` and `gh` CLI presence and authentication state. Both checks are non-blocking — failures are surfaced to the user on stderr but do not halt the install flow. This follows NFR-6 (graceful warnings on missing tools) and ensures the installer completes even if the user hasn't yet set up all optional automation prerequisites.

## How it works

`tooling.js` exports two functions:

- `checkGit()` — Runs `git --version` and returns `null` on success. On failure, returns a recovery message: "git not found on PATH — install git before running projects with auto_commit."
- `checkGh()` — Runs `gh auth status` and returns `null` on success. On failure, distinguishes two cases: `ENOENT` (gh not installed) and any other error (gh installed but not authenticated). Returns a recovery message in each case.

Each check is wrapped in `try`/`catch`. No exception is thrown; failures are converted to human-readable strings.

Return value contract: `null | string`. A return of `null` means the tool is available and healthy. A string return is the error message with recovery hint. The caller (`index.js`, before `runWizard`) logs the message to stderr and continues installation without interruption.

## Coding standards

- **Return shape**: Always `null` (success) or `string` (error message with recovery hint per NFR-11). Never throw.
- **Non-blocking failures**: The wizard does not halt on missing git or gh. `auto_pr=ask` is the default in `orchestration.yml`; the user can disable automation or authenticate during project setup.
- **Recovery hints**: Every error message names the missing tool and provides installation / authentication steps (NFR-11).
- **No state mutation**: Checks are pure functions. They only invoke the tool and return a result.

## Seams to other modules

**Called by**: `index.js` before `runWizard` completes setup.

**Returns**: Error messages logged to stderr by caller; no exceptions thrown.

**Never imports from**: `lib/install/` — the checks module is orthogonal to the install state machine and does not depend on harness-specific logic.

**Seams to other modules**: Isolated utility; no dependencies on other lib or build-script modules.
