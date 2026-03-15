---
project: "EXECUTE-BEHAVIORAL-TESTS"
phase: 1
task: 3
title: "Fix YAML Parser Array-of-Objects"
status: "pending"
skills_required: ["code", "run-tests"]
skills_optional: []
estimated_files: 2
---

# Fix YAML Parser Array-of-Objects

## Objective

Verify that the YAML parser array-of-objects fix has been correctly applied to both `yaml-parser.js` and `frontmatter.js`, run existing test suites against both files to confirm correct behavior and no regressions, and document the changes in the task report.

## Context

The YAML parser fix was already applied out-of-band during pipeline bootstrapping (it was needed to unblock the pipeline itself). Two files were modified: `yaml-parser.js` (the stack-based `parseYaml` function used by the validation system) and `frontmatter.js` (a separate `parseYaml` function used by `extractFrontmatter()` for actual frontmatter parsing). Both had the same bug — list items containing key-value pairs (e.g., `- id: "T01"`) were parsed as scalar strings instead of objects. The fix uses `findKeyColon()` to detect key-value pairs in list items and parses them as objects, with continuation line consumption for multi-property items. Your job is to verify both files match the expected AFTER code, run tests, and report results.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| VERIFY | `.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser.js` | Verify list-item branch matches expected AFTER code (lines ~62–93) |
| VERIFY | `.github/skills/validate-orchestration/scripts/lib/utils/frontmatter.js` | Verify `parseYaml` function's list-item handling matches expected AFTER code (lines ~160–195) |

## Implementation Steps

1. **Read `yaml-parser.js`** at `.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser.js` — locate the list-item branch (the `if (trimmed.startsWith('- '))` block). Verify it matches the expected AFTER code in the "Contracts & Interfaces" section below.

2. **Read `frontmatter.js`** at `.github/skills/validate-orchestration/scripts/lib/utils/frontmatter.js` — locate the `parseYaml` function's list-item handling (the `while` loop that processes `yamlLines`). Verify the list-item branch matches the expected AFTER code in the "Contracts & Interfaces" section below.

3. **Run the YAML parser test suite**: Execute `node .github/orchestration/scripts/tests/yaml-parser.test.js` — confirm all tests pass (0 failures). This test suite imports `parseYaml` from `yaml-parser.js` and validates scalar lists, nested objects, type coercion, comments, edge cases, and the full reference YAML.

4. **Run the frontmatter test suite**: Execute `node .github/orchestration/scripts/tests/frontmatter.test.js` — confirm all tests pass (0 failures). This test suite imports `extractFrontmatter` from `frontmatter.js` and validates standard frontmatter, fenced frontmatter, list values, and edge cases.

5. **Verify array-of-objects behavior manually** (if no existing test covers it): Create a small inline test that parses YAML containing `- key: value` list items and confirms the output is an array of objects, not an array of strings. Test with:
   - Single key-value list item: `- id: "T01"` → `{ id: "T01" }`
   - Multi-property list item: `- id: "T01"\n    title: "First"` → `{ id: "T01", title: "First" }`
   - Plain scalar list item: `- plain item` → `"plain item"` (no regression)
   - Mixed list: combination of object items and scalar items in the same array

6. **If either file does NOT match the expected AFTER code**: Report the discrepancy in the task report. Do NOT modify the files — flag the issue for the Orchestrator to resolve.

7. **If tests fail**: Capture the failure output (test name, assertion, expected/actual) and report in the task report. Do NOT modify the source files.

8. **Generate a task report** documenting: files verified, test results (pass/fail counts), any discrepancies found, and confirmation that the fix is correctly applied.

## Contracts & Interfaces

### Expected AFTER code — `yaml-parser.js` list-item branch

**File:** `.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser.js`
**Function:** `parseYaml(yamlString)` — stack-based parser
**Location:** The `if (trimmed.startsWith('- '))` block (approximately lines 62–93)

```javascript
// ── List item: - value ──────────────────────────────────────────
if (trimmed.startsWith('- ')) {
  if (Array.isArray(current)) {
    const itemContent = trimmed.slice(2).trim();
    const colonIdx = findKeyColon(itemContent);
    if (colonIdx !== -1) {
      // Key-value pair → object item
      const obj = {};
      const key = itemContent.slice(0, colonIdx).trim();
      const rawValue = itemContent.slice(colonIdx + 1).trim();
      obj[key] = parseScalar(rawValue);
      // Consume continuation lines (indented deeper than the `- ` prefix)
      const itemIndent = indent + 2; // indent of content after `- `
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextIndent = getIndent(nextLine);
        const nextTrimmed = nextLine.trim();
        if (nextTrimmed === '' || nextIndent <= indent) break;
        const contColonIdx = findKeyColon(nextTrimmed);
        if (contColonIdx !== -1) {
          const contKey = nextTrimmed.slice(0, contColonIdx).trim();
          const contRawValue = nextTrimmed.slice(contColonIdx + 1).trim();
          obj[contKey] = parseScalar(contRawValue);
        }
        i++;
      }
      current.push(obj);
    } else {
      // No colon → scalar item (existing behavior)
      current.push(parseScalar(itemContent));
    }
  }
  i++;
  continue;
}
```

**Key elements to verify:**
- `findKeyColon(itemContent)` is called to detect key-value pairs
- Key-value detection creates an object `{}` and parses using `parseScalar()`
- Continuation line loop: reads `lines[i + 1]`, checks `nextIndent <= indent` to break
- `getIndent()` and `findKeyColon()` are used (existing functions, not new)
- Scalar fallback (`else` branch) retains `current.push(parseScalar(itemContent))`

### Expected AFTER code — `frontmatter.js` list-item handling

**File:** `.github/skills/validate-orchestration/scripts/lib/utils/frontmatter.js`
**Function:** `parseYaml(yamlLines)` — array-of-lines parser (separate from yaml-parser.js)
**Location:** Inside the `while (j < yamlLines.length && yamlLines[j].match(/^\s+-\s+/))` loop

```javascript
while (j < yamlLines.length && yamlLines[j].match(/^\s+-\s+/)) {
  const itemMatch = yamlLines[j].match(/^\s+-\s+(.*)/);
  if (itemMatch) {
    const itemContent = itemMatch[1].trim();
    const colonMatch = itemContent.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)/);
    if (colonMatch) {
      // Key-value pair → object item
      const obj = {};
      obj[colonMatch[1]] = parseScalar(colonMatch[2].trim());
      // Consume continuation lines (indented deeper, not a new list item)
      let k = j + 1;
      while (k < yamlLines.length) {
        const contLine = yamlLines[k];
        const contTrimmed = contLine.trim();
        if (contTrimmed === '' || contLine.match(/^\s+-\s+/) || !contLine.match(/^\s+/)) break;
        const contMatch = contTrimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)/);
        if (contMatch) {
          obj[contMatch[1]] = parseScalar(contMatch[2].trim());
        }
        k++;
      }
      listItems.push(obj);
      j = k;
    } else {
      listItems.push(parseScalar(itemContent));
      j++;
    }
  } else {
    j++;
  }
}
```

**Key elements to verify:**
- `colonMatch` regex detects key-value pairs in list items: `/^([A-Za-z0-9_-]+)\s*:\s*(.*)/`
- Key-value detection creates an object `{}` and calls `parseScalar()` for the value
- Continuation loop (`k` index): breaks on empty line, new list item (`/^\s+-\s+/`), or non-indented line
- Continuation key-value pairs parsed with same regex pattern and added to same object
- `j = k` after consuming continuation lines (advances past all consumed lines)
- Scalar fallback: `listItems.push(parseScalar(itemContent))` with `j++`

### Input/Output Contract (both parsers)

```yaml
# Input
tasks:
  - id: "T01"
    title: "First Task"
  - id: "T02"
    title: "Second Task"
  - plain scalar item
```

```javascript
// Expected output
{
  tasks: [
    { id: "T01", title: "First Task" },
    { id: "T02", title: "Second Task" },
    "plain scalar item"
  ]
}
```

## Styles & Design Tokens

Not applicable — this is an infrastructure utility fix, not a UI task.

## Test Requirements

- [ ] YAML parser test suite (`node .github/orchestration/scripts/tests/yaml-parser.test.js`) passes with 0 failures
- [ ] Frontmatter test suite (`node .github/orchestration/scripts/tests/frontmatter.test.js`) passes with 0 failures
- [ ] `- key: value` list items produce `{ key: value }` objects (not scalar strings)
- [ ] Multi-line list items (`- id: "T01"` + indented `title: "First"`) produce `{ id: "T01", title: "First" }`
- [ ] `- plain item` (no colon) still produces a scalar string (existing behavior preserved)
- [ ] Continuation lines break correctly on empty line or reduced indent

## Acceptance Criteria

- [ ] `yaml-parser.js` list-item branch matches the expected AFTER code specified above
- [ ] `frontmatter.js` `parseYaml` list-item handling matches the expected AFTER code specified above
- [ ] YAML parser test suite executes with 0 failures
- [ ] Frontmatter test suite executes with 0 failures
- [ ] Array-of-objects parsing verified: `- key: value` → `{ key: value }` in both parsers
- [ ] Multi-property object parsing verified: continuation lines produce additional properties on the same object
- [ ] Scalar list items still parse as strings (no regression)
- [ ] No new utility functions added — fix uses existing `findKeyColon()` / `parseScalar()` in yaml-parser.js and regex matching in frontmatter.js
- [ ] Task report generated documenting verification results

## Constraints

- Do NOT modify `yaml-parser.js` or `frontmatter.js` — the fix is already applied. This task is verification only.
- Do NOT modify `findKeyColon()` or `parseScalar()` in yaml-parser.js
- Do NOT add new npm dependencies
- Do NOT modify existing test files — only run them
- If a discrepancy is found between the actual code and expected AFTER code, report it in the task report. Do not attempt to fix it.
- One level of nesting only — deeply nested YAML structures are explicitly unsupported (NFR-7)
