# Edge Case Hardening

## Objective

Verify that all check modules handle missing directories, empty files, corrupt frontmatter, invalid YAML, and missing SKILL.md gracefully — returning informative `fail`/`warn` results without crashing. Add test coverage for any edge-case scenarios that are not already tested.

## Context

The validator has 7 check modules (`structure`, `agents`, `skills`, `config`, `instructions`, `prompts`, `cross-refs`) and 3 utility modules (`fs-helpers`, `frontmatter`, `yaml-parser`). Each utility uses try/catch and returns `null` or empty arrays on failure. Each check module wraps its logic in a top-level try/catch returning a single-element `fail` array on unexpected errors. This task audits those paths, fixes any module that would crash on edge-case inputs, and adds test coverage for each scenario.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `lib/checks/structure.js` | Fix if any edge case crashes |
| MODIFY | `lib/checks/agents.js` | Fix if any edge case crashes |
| MODIFY | `lib/checks/skills.js` | Fix if any edge case crashes |
| MODIFY | `lib/checks/config.js` | Fix if any edge case crashes |
| MODIFY | `lib/checks/instructions.js` | Fix if any edge case crashes |
| MODIFY | `lib/checks/prompts.js` | Fix if any edge case crashes |
| MODIFY | `lib/checks/cross-refs.js` | Fix if any edge case crashes |
| MODIFY | `tests/structure.test.js` | Add edge-case tests |
| MODIFY | `tests/agents.test.js` | Add edge-case tests |
| MODIFY | `tests/skills.test.js` | Add edge-case tests |
| MODIFY | `tests/config.test.js` | Add edge-case tests |
| MODIFY | `tests/instructions.test.js` | Add edge-case tests |
| MODIFY | `tests/prompts.test.js` | Add edge-case tests |
| MODIFY | `tests/cross-refs.test.js` | Add edge-case tests |

## Implementation Steps

1. **Audit each check module** for crash-on-edge-case paths using the scenarios listed in the Test Requirements section below. For each scenario, trace the call through the module and confirm it returns a result array (never throws past the top-level catch).

2. **Fix `structure.js`** if needed. Current top-level catch returns a single fail result — verify it fires when `basePath` is `null` or points to a non-existent directory. The current catch block:
   ```javascript
   } catch (err) {
     return [
       {
         category: 'structure',
         name: 'structure-check-error',
         status: 'fail',
         message: err.message,
       },
     ];
   }
   ```

3. **Fix `agents.js`** if needed. Current pattern: `listFiles()` returns `[]` when directory doesn't exist (safe), `readFile()` returns `null` when file is unreadable (handled with early return), `extractFrontmatter()` returns `{ frontmatter: null, body: '' }` on empty/corrupt content (handled with early return). The top-level catch:
   ```javascript
   } catch (err) {
     return [
       {
         category: 'agents',
         name: 'agent-check-error',
         status: 'fail',
         message: err.message
       }
     ];
   }
   ```

4. **Fix `skills.js`** if needed. Current pattern: `listDirs()` returns `[]` when directory doesn't exist (safe), `readFile()` returns `null` (handled with `continue`), `extractFrontmatter()` returns `null` frontmatter (handled with `continue`). When a skill dir has no SKILL.md, it emits a fail result and continues. The top-level catch:
   ```javascript
   } catch (err) {
     return [
       {
         category: CATEGORY,
         name: 'skill-check-error',
         status: 'fail',
         message: err.message
       }
     ];
   }
   ```

5. **Fix `config.js`** if needed. Current pattern: `readFile()` returns `null` → returns single fail result and sets `context.config = null`. `parseYaml()` returns `null` → returns single fail result. The top-level catch:
   ```javascript
   } catch (err) {
     context.config = null;
     return [{
       category: CATEGORY,
       name: 'orchestration.yml',
       status: 'fail',
       message: `Unexpected error: ${err.message}`,
       detail: {
         expected: 'No errors',
         found: err.message
       }
     }];
   }
   ```

6. **Fix `instructions.js`** if needed. Current pattern: `listFiles()` returns `[]` on missing directory (safe), `readFile()` returns `null` (handled with `continue`), `extractFrontmatter()` returns `null` frontmatter (handled with `continue`). Top-level catch:
   ```javascript
   } catch (err) {
     return [
       {
         category: CATEGORY,
         name: 'instruction-check-error',
         status: 'fail',
         message: err.message
       }
     ];
   }
   ```

7. **Fix `prompts.js`** if needed. Same pattern as `instructions.js` — `listFiles()` returns `[]` on missing dir, `readFile()` returns `null` (handled), `extractFrontmatter()` returns `null` (handled). Top-level catch:
   ```javascript
   } catch (err) {
     return [
       {
         category: CATEGORY,
         name: 'prompt-check-error',
         status: 'fail',
         message: err.message
       }
     ];
   }
   ```

8. **Fix `cross-refs.js`** if needed. Gracefully handles empty/null context sections — uses fallback defaults:
   ```javascript
   const agents = (context.agents instanceof Map) ? context.agents : new Map();
   const skills = (context.skills instanceof Map) ? context.skills : new Map();
   const config = context.config;
   ```
   Top-level catch:
   ```javascript
   } catch (err) {
     return [{
       category: CATEGORY,
       name: 'cross-refs',
       status: 'fail',
       message: `Unexpected error during cross-reference checks: ${err.message}`,
       detail: {
         expected: 'No errors',
         found: err.message,
       },
     }];
   }
   ```

9. **Add edge-case tests** to each test file for the scenarios listed below. Use the existing mock/stub patterns already in those test files. Each test should confirm: (a) no exception thrown, (b) returns an array, (c) fail/warn results contain informative messages.

10. **Run the full test suite** (`node --test tests/*.test.js`) and confirm all tests pass with zero failures.

## Contracts & Interfaces

Every check module exports an async function with this signature:

```javascript
/**
 * @param {string} basePath - Absolute path to workspace root (parent of .github/)
 * @param {object} context  - Mutable shared discovery context
 * @returns {Promise<Array<CheckResult>>}
 */
```

Where `CheckResult` is:

```javascript
/**
 * @typedef {Object} CheckResult
 * @property {string} category - Check category name
 * @property {string} name     - Identifies the entity checked (filename, dir name, etc.)
 * @property {'pass'|'fail'|'warn'} status
 * @property {string} message  - Human-readable description
 * @property {{ expected: string, found: string, context?: string }} [detail]
 */
```

Utility return contracts:
- `fs-helpers.exists(path)` → `boolean` (never throws)
- `fs-helpers.isDirectory(path)` → `boolean` (never throws)
- `fs-helpers.listFiles(dir, suffix?)` → `string[]` (returns `[]` on error)
- `fs-helpers.listDirs(dir)` → `string[]` (returns `[]` on error)
- `fs-helpers.readFile(path)` → `string | null` (returns `null` on error)
- `frontmatter.extractFrontmatter(content)` → `{ frontmatter: object|null, body: string }` (never throws)
- `yaml-parser.parseYaml(str)` → `object | null` (returns `null` on error)

## Test Requirements

### Edge-Case Scenarios to Test

For **each check module** (`structure`, `agents`, `skills`, `config`, `instructions`, `prompts`, `cross-refs`), add tests covering the following scenarios (skip if already covered by existing tests — check first):

#### Missing `.github/` directory
- Pass a `basePath` that does not contain a `.github/` directory.
- Expected: Returns an array (no throw). For `structure.js`, expect fail results for missing directories. For other modules, expect empty results or fail results (not a crash).

#### Empty agent/skill/instruction/prompt directories
- The relevant directory exists but contains zero matching files.
- Expected: Returns an empty array or appropriate warn/fail results. `context` maps/arrays are initialized but empty.

#### Files with empty content
- `readFile()` returns `''` (empty string).
- Expected: `extractFrontmatter()` returns `{ frontmatter: null, body: '' }`. Check modules emit a fail result ("No valid frontmatter found") and continue processing.

#### Files with corrupt/unparseable frontmatter
- Content has `---` delimiters but garbage YAML inside (e.g., `---\n:::broken:::\n---`).
- Expected: `extractFrontmatter()` returns `{ frontmatter: null, body: ... }`. Check modules emit a fail result and continue.

#### Missing `orchestration.yml` or invalid YAML
- For `config.js`: `readFile()` returns `null` (missing file) or returns content that `parseYaml()` can't parse.
- Expected: Returns single fail result, sets `context.config = null`.

#### Skill directories with no SKILL.md
- A subdirectory exists in `.github/skills/` but has no `SKILL.md` file inside.
- Expected: `skills.js` emits a fail result ("Missing SKILL.md") and continues to next skill directory.

#### Null/undefined context properties (cross-refs)
- Call `checkCrossRefs` with `context` having `agents: undefined`, `skills: undefined`, `config: null`.
- Expected: Returns an array (no throw). Falls back to empty Maps.

#### Non-string basePath
- Pass `null` or `undefined` as `basePath`.
- Expected: Top-level catch fires, returns a single fail result array.

### Per-Module Test Additions

**`tests/structure.test.js`** — Add:
- Test: `basePath` pointing to non-existent dir → returns results array (fails for missing dirs, no crash)
- Test: `basePath` is `null` → returns fail result from catch block

**`tests/agents.test.js`** — Add (if not already present):
- Test: Empty content file (readFile returns `''`) → fail for no frontmatter
- Test: Corrupt frontmatter → fail for no valid frontmatter
- Test: `basePath` is `null` → returns fail result from catch block

**`tests/skills.test.js`** — Add:
- Test: Skill dir exists but no SKILL.md → fail result "Missing SKILL.md"
- Test: Empty SKILL.md content → fail for no frontmatter
- Test: Corrupt frontmatter in SKILL.md → fail for no frontmatter
- Test: Empty skills directory (no subdirectories) → returns empty results

**`tests/config.test.js`** — Add:
- Test: `readFile` returns `null` → single fail, `context.config` is `null`
- Test: `readFile` returns unparseable content → single fail, `context.config` is `null`
- Test: `readFile` returns empty string → single fail (parseYaml returns null)

**`tests/instructions.test.js`** — Add:
- Test: Empty directory (no .instructions.md files) → empty results
- Test: Instruction file with empty content → fail for no frontmatter
- Test: Instruction file with corrupt frontmatter → fail for no frontmatter

**`tests/prompts.test.js`** — Add:
- Test: Empty directory (no .prompt.md files) → empty results
- Test: Prompt file with empty content → fail for no frontmatter
- Test: Prompt file with corrupt frontmatter → fail for no frontmatter

**`tests/cross-refs.test.js`** — Add:
- Test: Completely empty context (`{}`) → returns array, no crash
- Test: Context with `agents: null`, `skills: null`, `config: null` → returns array
- Test: `basePath` is `null` → top-level catch returns fail result

## Acceptance Criteria

- [ ] `checkStructure(null, {})` returns an array without throwing
- [ ] `checkAgents('/nonexistent', ctx)` returns an array without throwing
- [ ] `checkSkills('/nonexistent', ctx)` returns an array without throwing; `ctx.skills` is a Map
- [ ] `checkConfig('/nonexistent', ctx)` returns an array without throwing; `ctx.config` is `null`
- [ ] `checkInstructions('/nonexistent', ctx)` returns an array without throwing
- [ ] `checkPrompts('/nonexistent', ctx)` returns an array without throwing
- [ ] `checkCrossRefs('/any', {})` returns an array without throwing
- [ ] Empty-content agent files produce a fail result with message containing "frontmatter"
- [ ] Corrupt YAML in orchestration.yml produces a fail result, not a crash
- [ ] Skill directory with no SKILL.md produces a fail result "Missing SKILL.md"
- [ ] Every fail result from edge cases includes both `expected` and `found` in its `detail` object
- [ ] All new tests pass (`node --test tests/*.test.js`)
- [ ] All pre-existing tests still pass (no regressions)
- [ ] No lint errors

## Constraints

- Do NOT add new validation rules or check logic — only verify existing logic handles edge cases
- Do NOT modify the `CheckResult` interface or utility return types
- Do NOT change the module export signatures
- Do NOT introduce external dependencies
- Scope is bounded to the scenarios listed above — do not expand to additional edge cases
- Use the existing mock/stub patterns in each test file — do not introduce a new test framework
