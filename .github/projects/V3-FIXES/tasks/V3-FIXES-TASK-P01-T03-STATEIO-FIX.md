---
project: "V3-FIXES"
phase: 1
task: 3
title: "state-io.js CWD Fix"
status: "pending"
skills_required: ["code"]
skills_optional: []
estimated_files: 1
---

# state-io.js CWD Fix

## Objective

Replace the `process.cwd()`-based config fallback path in `readConfig` with a `__dirname`-relative path so that `readConfig` resolves the correct orchestration config file regardless of the process working directory.

## Context

`state-io.js` is the I/O module for the orchestration pipeline. Its `readConfig` function loads `.github/orchestration.yml`. When no explicit `configPath` argument is supplied, the current fallback constructs the path using `process.cwd()`, which breaks if any prior terminal command has changed the working directory away from the workspace root. Since `state-io.js` lives at a fixed location relative to the config file, `__dirname` provides a stable anchor. The `path` module is already imported — no new imports are needed.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib/state-io.js` | Single-line change in `readConfig` fallback path |

## Implementation Steps

1. Open `.github/orchestration/scripts/lib/state-io.js`.
2. Locate the `readConfig` function (starts at line 77).
3. Find line 80 inside the `if (!resolvedPath)` block — it currently reads:
   ```javascript
       resolvedPath = path.join(process.cwd(), '.github', 'orchestration.yml');
   ```
4. Replace that single line with:
   ```javascript
       resolvedPath = path.resolve(__dirname, '../../../orchestration.yml');
   ```
5. Verify `path` is already imported (line 4: `const path = require('path');`) — no import changes needed.
6. Save the file. No other lines should change.

## Contracts & Interfaces

The `readConfig` function signature and return contract remain unchanged:

```javascript
/**
 * @param {string|undefined} configPath — optional explicit path to orchestration.yml
 * @returns {object} — merged config object (DEFAULT_CONFIG overridden by parsed YAML)
 */
function readConfig(configPath) {
  let resolvedPath = configPath;
  if (!resolvedPath) {
    // CHANGE THIS LINE ↓
    resolvedPath = path.resolve(__dirname, '../../../orchestration.yml');
  }
  if (exists(resolvedPath)) {
    const content = readFile(resolvedPath);
    if (content !== null) {
      const parsed = parseYaml(content);
      if (parsed) {
        return mergeConfig(parsed);
      }
    }
  }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}
```

The function is exported as part of the module's public API and consumed by `createRealIO()` and direct callers. The return type does not change.

## Styles & Design Tokens

N/A — this is a backend script change with no UI component.

## Test Requirements

- [ ] All existing tests in `mutations.test.js` pass unchanged
- [ ] All existing tests in `pipeline-behavioral.test.js` pass unchanged
- [ ] All existing tests in `resolver.test.js` pass unchanged
- [ ] `readConfig()` (called with no argument) resolves to the correct `.github/orchestration.yml` path regardless of CWD

## Acceptance Criteria

- [ ] `readConfig` resolves the correct config path regardless of the current working directory
- [ ] The `path` module is imported (already present on line 4 — verify it remains intact)
- [ ] All existing tests pass unchanged (zero regressions)
- [ ] Only `.github/orchestration/scripts/lib/state-io.js` is modified
- [ ] The change is exactly one line: line 80 replacement from `path.join(process.cwd(), '.github', 'orchestration.yml')` to `path.resolve(__dirname, '../../../orchestration.yml')`

## Constraints

- Do NOT modify any file other than `.github/orchestration/scripts/lib/state-io.js`
- Do NOT change the `readConfig` function signature or return type
- Do NOT add new imports — `path` is already imported
- Do NOT modify `readState`, `writeState`, `readDocument`, `ensureDirectories`, or any other function in this file
- Do NOT refactor surrounding code — this is a surgical one-line fix

## Path Derivation Reference

```
state-io.js lives at:  .github/orchestration/scripts/lib/state-io.js
__dirname            =  <workspace>/.github/orchestration/scripts/lib/
../                  →  <workspace>/.github/orchestration/scripts/
../../               →  <workspace>/.github/orchestration/
../../../            →  <workspace>/.github/
../../../orchestration.yml  →  <workspace>/.github/orchestration.yml  ✅
```
