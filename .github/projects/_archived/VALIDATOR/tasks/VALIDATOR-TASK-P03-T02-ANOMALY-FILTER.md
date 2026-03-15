---
project: "VALIDATOR"
phase: 3
task: 2
title: "Anomaly Detection & Category Filter"
status: "pending"
skills_required: ["code"]
skills_optional: []
estimated_files: 3
---

# Anomaly Detection & Category Filter

## Objective

Implement FR-22 anomaly detection in `lib/checks/skills.js` to warn when bare files exist in `.github/skills/` (specifically `create-skill`), and verify that the `--category` CLI filter correctly runs all prerequisite checks silently before reporting only the filtered category's results.

## Context

The `.github/skills/` directory contains skill subdirectories (e.g., `create-agent/`, `create-prd/`) but also contains a bare file `create-skill` that is not a proper skill directory. The current `checkSkills` function only iterates directories via `listDirs()` and never notices bare files. The `--category` filter in `validate-orchestration.js` currently runs ALL check modules sequentially (populating the shared `context` object) then filters `allResults` to the requested category before passing to the reporter. This means prerequisites are already silently loaded — verify this behavior is correct and add test coverage.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `lib/checks/skills.js` | Add bare file anomaly detection |
| MODIFY | `tests/skills.test.js` | Add tests for anomaly detection |
| MODIFY | `validate-orchestration.js` | Only if category filter needs fixes (verify first) |

## Implementation Steps

1. **In `lib/checks/skills.js`**, add an import for `listFiles` from `../utils/fs-helpers` (it is already exported but not currently imported by skills.js).

2. **After the `listDirs()` call** (around line 55), add a new section that calls `listFiles(skillsDir)` to get all bare files in the `.github/skills/` directory. For each file found, emit a `warn` result:
   ```javascript
   // ── Anomaly: bare files in skills directory ──
   const bareFiles = listFiles(skillsDir);
   for (const fileName of bareFiles) {
     results.push({
       category: CATEGORY,
       name: fileName,
       status: 'warn',
       message: `Bare file in skills directory (expected a subdirectory with SKILL.md)`,
       detail: {
         expected: 'Skill directory containing SKILL.md',
         found: `Bare file: ${fileName}`
       }
     });
   }
   ```

3. **In `tests/skills.test.js`**, update the mock setup. The existing mock for `listFiles` is a static `() => []`. Change the mock pattern to match `listDirs` — create a `let mockListFiles = () => [];` variable and wire the proxy to use it:
   ```javascript
   let mockListFiles = () => [];
   ```
   Update the cache proxy:
   ```javascript
   listFiles: (...args) => mockListFiles(...args),
   ```

4. **Add a new `describe('Anomaly detection — bare files', ...)` block** in `tests/skills.test.js` with these tests:
   - **"warns on bare files in skills directory"**: Set `mockListFiles` to return `['create-skill']` and `mockListDirs` to return `[]`. Call `checkSkills`. Assert at least one result has `status: 'warn'`, `name: 'create-skill'`, and message containing `'Bare file'`.
   - **"no warnings when no bare files"**: Set `mockListFiles` to return `[]` and `mockListDirs` to return `[]`. Call `checkSkills`. Assert no warn results.
   - **"warns on multiple bare files"**: Set `mockListFiles` to return `['file-a', 'file-b']`. Assert two warn results, one for each file name.

5. **Verify `--category` filter logic** in `validate-orchestration.js` (lines 88-103). The current implementation:
   - Runs ALL `CHECK_MODULES` in order regardless of `--category` (line 95-99)
   - Filters `allResults` to the requested category AFTER all checks run (line 101)
   - Passes only filtered results to `report()` (line 103)
   - Counts failures only from filtered results for exit code (line 109)
   
   This is the correct "silent prerequisite" pattern described in the Architecture. Cross-references get a fully populated `context` object even when `--category cross-references` is specified. **No code change needed** unless the logic deviates from above. If it matches, add a comment to make the intent explicit:
   ```javascript
   // Run ALL checks to populate shared context (silent prerequisites).
   // --category filtering happens after all checks complete.
   ```

6. **Add a `describe('Category filter — silent prerequisites', ...)` block** in `tests/skills.test.js` (or create a small focused test section). This verifies that `checkSkills` populates `context.skills` correctly (the prerequisite data cross-refs depends on):
   - **"populates context.skills map for valid skills"**: Set up a valid skill directory mock. Call `checkSkills(basePath, context)`. Assert `context.skills.has('my-skill')` is `true` and the entry contains `folderName`, `frontmatter`, `hasTemplates`, `templateLinks`.

## Contracts & Interfaces

### CheckResult (from all check modules)
```javascript
/**
 * @typedef {Object} CheckResult
 * @property {string} category  - Check category (e.g., 'skills')
 * @property {string} name      - Identifier of the checked item
 * @property {'pass'|'fail'|'warn'} status - Result status
 * @property {string} message   - Human-readable result message
 * @property {object} [detail]  - Optional detail object
 * @property {string} detail.expected - What was expected
 * @property {string} detail.found    - What was found
 */
```

### fs-helpers — listFiles function signature
```javascript
/**
 * List files in a directory matching a suffix pattern.
 * @param {string} dirPath - Absolute path to directory
 * @param {string} [suffix] - File suffix to match. Empty/undefined = all files.
 * @returns {string[]} Array of filenames (not full paths). Empty array if directory doesn't exist.
 */
function listFiles(dirPath, suffix)
```

### DiscoveryContext.skills (populated by checkSkills)
```javascript
// context.skills is a Map<string, SkillInfo>
// Each entry:
{
  folderName: string,        // directory name
  frontmatter: object,       // parsed YAML frontmatter
  hasTemplates: boolean,     // whether templates/ subdirectory exists
  templateLinks: string[]    // resolved template link paths from body
}
```

## Test Requirements

- [ ] Test: bare file in skills directory emits a `warn` result with correct name, message, and detail
- [ ] Test: no bare files produces no warn results from anomaly detection
- [ ] Test: multiple bare files each produce individual warn results
- [ ] Test: `context.skills` map is populated correctly for valid skill directories (prerequisite data)
- [ ] All existing skills tests continue to pass (no regressions)

## Acceptance Criteria

- [ ] Running validator against live workspace emits a warning for `create-skill` bare file
- [ ] The anomaly warning has `status: 'warn'` (not `fail`) — it is informational, not blocking
- [ ] The warning `detail` includes `expected` and `found` fields per CheckResult contract
- [ ] `--category cross-references` still works correctly (prerequisites populate context silently)
- [ ] `--category skills` shows both normal skill results AND the anomaly warning
- [ ] All new tests pass
- [ ] All existing tests pass (204+ tests, zero regressions)
- [ ] No lint errors
- [ ] Build succeeds (node validate-orchestration.js exits without crash)

## Constraints

- Do NOT add a new check module — anomaly detection lives inside `lib/checks/skills.js`
- Do NOT change the `--category` filter mechanism if it already runs all checks and filters after — only add a clarifying comment
- Do NOT treat bare files as errors (`fail`) — they are warnings (`warn`) since they don't break the system
- Do NOT modify `lib/utils/fs-helpers.js` — the `listFiles` function already exists and works correctly
- Do NOT modify check modules other than `lib/checks/skills.js`
- Keep the anomaly detection section clearly separated from existing skill directory validation logic
