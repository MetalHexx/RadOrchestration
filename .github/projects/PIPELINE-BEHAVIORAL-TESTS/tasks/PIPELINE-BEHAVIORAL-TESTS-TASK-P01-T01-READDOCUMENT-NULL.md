---
project: "PIPELINE-BEHAVIORAL-TESTS"
phase: 1
task: 1
title: "Change readDocument to null-return contract"
status: "pending"
skills_required: ["code-modification", "test-update"]
skills_optional: []
estimated_files: 2
---

# Change readDocument to null-return contract

## Objective

Change `readDocument` in `state-io.js` from throwing errors on missing/unreadable files to returning `null`, and update the corresponding test in `state-io.test.js` so it asserts `null` return instead of `throws`.

## Context

`readDocument` currently throws `new Error('Document not found: ...')` when a file does not exist and `new Error('Failed to read document: ...')` when a file exists but cannot be read. All 7 call sites across the pipeline and triage engines already have null-check branches (e.g., `if (!doc) { ... }`), but those branches are dead code because the function throws before returning. Changing to `return null` makes those null-check branches live code and simplifies the entire call graph. The existing test suite's mock IO (`createMockIO`) already uses null-return semantics, so only the real-filesystem test in `state-io.test.js` needs updating.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib/state-io.js` | Replace both `throw` statements in `readDocument` with `return null` |
| MODIFY | `.github/orchestration/scripts/tests/state-io.test.js` | Change throw assertion to null-return assertion |

## Implementation Steps

1. Open `.github/orchestration/scripts/lib/state-io.js` and locate the `readDocument` function (starts at line 128).
2. Replace `throw new Error('Document not found: ' + docPath);` with `return null;` (line 130).
3. Replace `throw new Error('Failed to read document: ' + docPath);` with `return null;` (line 133).
4. Update the JSDoc `@throws` tag to reflect the new contract: remove `@throws {Error} If document not found` and update `@returns` to indicate `null` for missing/unreadable files.
5. Open `.github/orchestration/scripts/tests/state-io.test.js` and locate the throw assertion test (starts at line 207).
6. Replace the `assert.throws` test with a direct call that asserts `null` return.
7. Run `node --test .github/orchestration/scripts/tests/state-io.test.js` — all tests must pass.
8. Run `node --test .github/orchestration/scripts/tests/pipeline-engine.test.js` — all tests must pass (mock IO already uses null-return; no regressions expected).

## Contracts & Interfaces

### `readDocument` — Current Code (to be changed)

```javascript
// .github/orchestration/scripts/lib/state-io.js (lines 125–137)

/**
 * Read a markdown document and extract frontmatter.
 * @param {string} docPath - Absolute path to markdown document
 * @returns {{ frontmatter: Object|null, body: string }}
 * @throws {Error} If document not found
 */
function readDocument(docPath) {
  if (!exists(docPath)) {
    throw new Error('Document not found: ' + docPath);
  }
  const content = readFile(docPath);
  if (content === null) {
    throw new Error('Failed to read document: ' + docPath);
  }
  return extractFrontmatter(content);
}
```

### `readDocument` — New Code (target)

```javascript
// .github/orchestration/scripts/lib/state-io.js

/**
 * Read a markdown document and extract frontmatter.
 * @param {string} docPath - Absolute path to markdown document
 * @returns {{ frontmatter: Object|null, body: string } | null} Parsed document, or null if not found/unreadable
 */
function readDocument(docPath) {
  if (!exists(docPath)) {
    return null;
  }
  const content = readFile(docPath);
  if (content === null) {
    return null;
  }
  return extractFrontmatter(content);
}
```

**Contract**: `readDocument` returns `null` for any file that does not exist or cannot be read. Returns `{ frontmatter: Object|null, body: string }` on success. Never throws for missing/unreadable files.

### Test — Current Code (to be changed)

```javascript
// .github/orchestration/scripts/tests/state-io.test.js (lines 207–213)

  it('throws with "Document not found" message when file does not exist', () => {
    const docPath = path.join(tmpDir, 'missing.md');
    assert.throws(() => readDocument(docPath), (err) => {
      assert(err instanceof Error);
      assert(err.message.includes('Document not found'));
      return true;
    });
  });
```

### Test — New Code (target)

```javascript
// .github/orchestration/scripts/tests/state-io.test.js

  it('returns null when file does not exist', () => {
    const docPath = path.join(tmpDir, 'missing.md');
    const result = readDocument(docPath);
    assert.strictEqual(result, null);
  });
```

## Styles & Design Tokens

Not applicable — no UI changes.

## Test Requirements

- [ ] The existing test `'throws with "Document not found" message when file does not exist'` is replaced with `'returns null when file does not exist'` that asserts `readDocument` returns `null` for a non-existent path
- [ ] The existing test `'returns { frontmatter, body } for a markdown file with valid YAML frontmatter'` still passes (no regression on valid files)
- [ ] The existing test `'returns { frontmatter: null, body } for a markdown file without frontmatter'` still passes (no regression on files without frontmatter)
- [ ] All tests in `state-io.test.js` pass: `node --test .github/orchestration/scripts/tests/state-io.test.js`
- [ ] All tests in `pipeline-engine.test.js` pass: `node --test .github/orchestration/scripts/tests/pipeline-engine.test.js`

## Acceptance Criteria

- [ ] `readDocument` returns `null` when the file does not exist (not throws)
- [ ] `readDocument` returns `null` when the file exists but cannot be read (not throws)
- [ ] `readDocument` still returns `{ frontmatter, body }` for valid files (no regression)
- [ ] The `state-io.test.js` test for missing files asserts `null` return (not `throws`)
- [ ] All `state-io.test.js` tests pass
- [ ] All `pipeline-engine.test.js` tests pass
- [ ] No lint errors

## Constraints

- Do NOT modify any other function in `state-io.js` — only `readDocument` and its JSDoc
- Do NOT modify `extractFrontmatter`, `readFile`, or `exists` helper functions
- Do NOT add new test cases — only update the existing throw assertion test
- Do NOT modify any file other than `state-io.js` and `state-io.test.js`
- Do NOT change the function signature or add parameters to `readDocument`
- Do NOT add try/catch around `extractFrontmatter(content)` — if parsing fails, let it throw (that is a real error, not a missing file)
