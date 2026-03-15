---
project: "PIPELINE-BEHAVIORAL-TESTS"
phase: 1
task: 2
title: "Update createProjectAwareReader to null-check fallback"
status: "pending"
skills_required: ["code-modification", "test-update"]
skills_optional: []
estimated_files: 2
---

# Update createProjectAwareReader to null-check fallback

## Objective

Replace the try/catch pattern in `createProjectAwareReader` (in `pipeline-engine.js`) with a null-check that triggers the project-relative fallback, and update the "both fail" unit test in `pipeline-engine.test.js` to use a null-returning mock and assert `null` return instead of asserting a throw.

## Context

`readDocument` in `state-io.js` now returns `null` for missing/unreadable files instead of throwing. The `createProjectAwareReader` function wraps `readDocument` with a project-relative path fallback — it currently uses try/catch to detect a failed first resolution and retry with a project-relative path. Since `readDocument` no longer throws, the catch block is dead code: the fallback path never triggers. This task replaces the try/catch with a null-check so the fallback path is live again. The corresponding "both fail" test currently uses a throwing mock and `assert.throws` — it must switch to a null-returning mock and `assert.strictEqual(result, null)`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib/pipeline-engine.js` | Replace try/catch with null-check in `createProjectAwareReader` (~line 137) |
| MODIFY | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | Update "both fail" test (~line 1681) to use null-returning mock |

## Implementation Steps

1. Open `.github/orchestration/scripts/lib/pipeline-engine.js` and locate the `createProjectAwareReader` function (around line 137).

2. Replace the function body from try/catch to null-check. The **current code** is:
   ```js
   function createProjectAwareReader(readDocument, projectDir) {
     return function(docPath) {
       if (!docPath) return null;
       try {
         return readDocument(docPath);
       } catch (_) {
         // Path didn't resolve from CWD — try as project-relative
         const resolved = path.join(projectDir, docPath);
         return readDocument(resolved);
       }
     };
   }
   ```
   Replace with:
   ```js
   function createProjectAwareReader(readDocument, projectDir) {
     return function(docPath) {
       if (!docPath) return null;
       const result = readDocument(docPath);
       if (result !== null) return result;
       // Path didn't resolve from CWD — try as project-relative
       const resolved = path.join(projectDir, docPath);
       return readDocument(resolved);
     };
   }
   ```
   Do **not** change the JSDoc comment above the function. Do **not** change the function signature.

3. Open `.github/orchestration/scripts/tests/pipeline-engine.test.js` and locate the `createProjectAwareReader` describe block (around line 1642).

4. Find the test titled `'lets the second readDocument throw if both resolutions fail'` (around line 1681). The **current code** is:
   ```js
   it('lets the second readDocument throw if both resolutions fail', () => {
     function readDocument(p) { throw new Error(`Not found: ${p}`); }
     const reader = createProjectAwareReader(readDocument, '/test/project');
     assert.throws(() => reader('nonexistent.md'), /Not found/);
   });
   ```
   Replace with:
   ```js
   it('returns null when both resolutions fail', () => {
     function readDocument(p) { return null; }
     const reader = createProjectAwareReader(readDocument, '/test/project');
     const result = reader('nonexistent.md');
     assert.strictEqual(result, null);
   });
   ```

5. Verify that the **other two existing tests** in the `createProjectAwareReader` describe block still work with the new implementation:
   - `'returns the document when path resolves directly'` — this test's mock returns a document for a known path, and throws for unknown paths. After the change, the direct path still resolves, so the test passes. However, this mock still throws for unknown paths. Since the direct path is found, the null-check branch is never reached, so the throw is never triggered. **No change needed.**
   - `'falls back to project-relative path when direct resolution fails'` — this test's mock throws for the direct path and returns a document for the project-relative path. After the change, the first `readDocument` call will throw (the mock still throws), which will propagate as an **uncaught exception**. **This mock must also be updated**: change it from throwing to returning `null` for the direct path. The current code is:
     ```js
     it('falls back to project-relative path when direct resolution fails', () => {
       const path = require('path');
       const resolvedPath = path.join('/test/project', 'reports/task-report.md');
       const documents = {
         [resolvedPath]: { frontmatter: { status: 'complete' }, body: 'Fallback.' }
       };
       function readDocument(p) {
         if (documents[p]) return documents[p];
         throw new Error(`Not found: ${p}`);
       }
       const reader = createProjectAwareReader(readDocument, '/test/project');
       const result = reader('reports/task-report.md');
       assert.deepEqual(result, { frontmatter: { status: 'complete' }, body: 'Fallback.' });
     });
     ```
     Replace the mock's throw with a null return:
     ```js
     it('falls back to project-relative path when direct resolution fails', () => {
       const path = require('path');
       const resolvedPath = path.join('/test/project', 'reports/task-report.md');
       const documents = {
         [resolvedPath]: { frontmatter: { status: 'complete' }, body: 'Fallback.' }
       };
       function readDocument(p) {
         if (documents[p]) return documents[p];
         return null;
       }
       const reader = createProjectAwareReader(readDocument, '/test/project');
       const result = reader('reports/task-report.md');
       assert.deepEqual(result, { frontmatter: { status: 'complete' }, body: 'Fallback.' });
     });
     ```

6. Also update the `'returns the document when path resolves directly'` test mock for consistency — change its throw to a null return:
     Current:
     ```js
     function readDocument(p) {
       if (documents[p]) return documents[p];
       throw new Error(`Not found: ${p}`);
     }
     ```
     Replace with:
     ```js
     function readDocument(p) {
       if (documents[p]) return documents[p];
       return null;
     }
     ```
     This is not strictly required for the test to pass (the throw path is unreachable in this test), but it aligns the mock with the new `readDocument` contract and prevents a latent throw if paths change.

7. Run all tests to confirm zero regressions:
   - `node --test .github/orchestration/scripts/tests/pipeline-engine.test.js`
   - `node --test .github/orchestration/scripts/tests/state-io.test.js`

## Contracts & Interfaces

### `createProjectAwareReader` — Target Implementation

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js

/**
 * @param {Function} readDocument — the IO-injected readDocument function
 * @param {string} projectDir — absolute path to the project directory
 * @returns {Function} — a reader that tries direct path, then project-relative fallback
 */
function createProjectAwareReader(readDocument, projectDir) {
  return function(docPath) {
    if (!docPath) return null;
    const result = readDocument(docPath);
    if (result !== null) return result;
    // Path didn't resolve from CWD — try as project-relative
    const resolved = path.join(projectDir, docPath);
    return readDocument(resolved);
  };
}
```

**Behavioral contract**:
| Input | Output |
|-------|--------|
| `docPath` is null/undefined/empty string | Returns `null` (no `readDocument` call) |
| `readDocument(docPath)` returns a document object | Returns that document object |
| `readDocument(docPath)` returns `null`, `readDocument(path.join(projectDir, docPath))` returns a document | Returns the document from the project-relative path |
| `readDocument(docPath)` returns `null`, `readDocument(path.join(projectDir, docPath))` returns `null` | Returns `null` |

### `readDocument` — Upstream Contract (from T01, already applied)

```javascript
// .github/orchestration/scripts/lib/state-io.js
// readDocument returns { frontmatter, body } on success, null on missing/unreadable
```

This function **no longer throws** for missing or unreadable files. It returns `null`. This is why the try/catch in `createProjectAwareReader` must be replaced.

## Styles & Design Tokens

Not applicable — this task modifies internal JavaScript infrastructure with no visual interface.

## Test Requirements

- [ ] `createProjectAwareReader` test: `'returns the document when path resolves directly'` — mock returns document for known path, returns `null` for unknown; asserts the document is returned
- [ ] `createProjectAwareReader` test: `'falls back to project-relative path when direct resolution fails'` — mock returns `null` for direct path, returns document for project-relative path; asserts the fallback document is returned
- [ ] `createProjectAwareReader` test: `'returns null when both resolutions fail'` — mock returns `null` for all paths; asserts `null` is returned (renamed from `'lets the second readDocument throw if both resolutions fail'`)
- [ ] `createProjectAwareReader` test: `'returns null for null/empty docPath'` — unchanged, already passes (no mock changes needed)
- [ ] Integration test: `'task_completed with project-relative report_doc in state succeeds through triage'` — already uses `createMockIO` which returns `null` for missing docs; should still pass without changes

## Acceptance Criteria

- [ ] `createProjectAwareReader` returns the document when the direct path resolves
- [ ] `createProjectAwareReader` falls back to project-relative path when the direct path returns `null`
- [ ] `createProjectAwareReader` returns `null` when both paths return `null`
- [ ] `createProjectAwareReader` still returns `null` for null/empty `docPath` (no regression)
- [ ] The try/catch pattern is completely removed from `createProjectAwareReader`
- [ ] The "both fail" test uses a null-returning mock and asserts `null` return (not `assert.throws`)
- [ ] The "fallback" test uses a null-returning mock (not a throwing mock)
- [ ] All `pipeline-engine.test.js` tests pass
- [ ] All `state-io.test.js` tests pass (no regression from T01)
- [ ] Build succeeds
- [ ] No lint errors

## Constraints

- Do NOT modify any file other than `pipeline-engine.js` and `pipeline-engine.test.js`
- Do NOT change the function signature of `createProjectAwareReader` (still takes `readDocument` and `projectDir`, returns a function)
- Do NOT change the JSDoc comment above `createProjectAwareReader`
- Do NOT modify `state-io.js` — that was changed in T01 and must remain untouched
- Do NOT add new test cases — only update the existing three `createProjectAwareReader` unit test mocks/assertions
- Do NOT modify the integration test `'task_completed with project-relative report_doc in state succeeds through triage'` — it already uses `createMockIO` (null-returning) and should pass without changes
- Do NOT touch any other function in `pipeline-engine.js` — only `createProjectAwareReader`
