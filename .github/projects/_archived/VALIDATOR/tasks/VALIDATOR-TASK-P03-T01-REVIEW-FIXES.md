---
project: "VALIDATOR"
phase: 3
task: 1
title: "Review Fixes"
status: "in_progress"
skills_required: ["code"]
skills_optional: []
estimated_files: 5
---

# Review Fixes

## Objective

Fix all Phase 1 and Phase 2 review issues: extract shared tool constants into a new module, add the missing `prompt` fence type to frontmatter parsing, remove duplicate template link validation from cross-refs, and add category display name mapping to the reporter.

## Context

The VALIDATOR CLI tool has 7 check modules wired through `validate-orchestration.js`. Two review cycles identified four fixes needed before Phase 3 feature work can proceed. The tool constants (`VALID_TOOLSETS`, `VALID_NAMESPACED_TOOLS`, `DEPRECATED_TOOLS`) are duplicated across `agents.js` and `prompts.js`. The frontmatter parser does not recognize `prompt` as a fence type. The `cross-refs.js` module re-validates skill template links that `skills.js` already checks. The reporter displays raw category IDs instead of human-friendly names.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `lib/utils/constants.js` | Shared tool constants module |
| MODIFY | `lib/checks/agents.js` | Remove constant definitions, import from constants.js |
| MODIFY | `lib/checks/prompts.js` | Remove constant definitions, import from constants.js |
| MODIFY | `lib/checks/cross-refs.js` | Remove `checkSkillTemplateLinks()` and its call |
| MODIFY | `lib/utils/frontmatter.js` | Add `prompt` to fenced block regex |
| MODIFY | `lib/reporter.js` | Add category display name mapping |

## Implementation Steps

1. **Create `lib/utils/constants.js`** — Define and export `VALID_TOOLSETS`, `VALID_NAMESPACED_TOOLS`, and `DEPRECATED_TOOLS` with the exact values shown in the Contracts section below.

2. **Modify `lib/checks/agents.js`** — Remove the three constant definitions (`VALID_TOOLSETS`, `VALID_NAMESPACED_TOOLS`, `DEPRECATED_TOOLS`) and add `const { VALID_TOOLSETS, VALID_NAMESPACED_TOOLS, DEPRECATED_TOOLS } = require('../utils/constants');` at the top alongside existing requires.

3. **Modify `lib/checks/prompts.js`** — Remove the two constant definitions (`VALID_TOOLSETS`, `VALID_NAMESPACED_TOOLS`) and add `const { VALID_TOOLSETS, VALID_NAMESPACED_TOOLS } = require('../utils/constants');` at the top alongside existing requires. (Prompts module does not use `DEPRECATED_TOOLS`.)

4. **Modify `lib/utils/frontmatter.js`** — Change the fenced block regex on line 31 from:
   ```js
   const fencedMatch = lines[0].match(/^```(chatagent|instructions|skill)\s*$/i);
   ```
   to:
   ```js
   const fencedMatch = lines[0].match(/^```(chatagent|instructions|skill|prompt)\s*$/i);
   ```

5. **Modify `lib/checks/cross-refs.js`** — Delete the entire `checkSkillTemplateLinks()` function (lines ~131–165) and remove its call from the main `checkCrossRefs` export (the line `results.push(...checkSkillTemplateLinks(basePath, skills));`).

6. **Modify `lib/reporter.js`** — Add a `CATEGORY_DISPLAY_NAMES` map after the existing constants section, and use it in `renderCategoryBlock` to translate raw category IDs to display names. The map and usage are specified in the Contracts section below.

## Contracts & Interfaces

### `lib/utils/constants.js` — Full File Content (CREATE)

```javascript
'use strict';

// ─── Shared Tool Constants ────────────────────────────────────────────────────

/** Valid toolset names for agent/prompt tools arrays */
const VALID_TOOLSETS = ['read', 'search', 'edit', 'execute', 'web', 'todo', 'agent', 'vscode'];

/** Known valid namespaced tool identifiers */
const VALID_NAMESPACED_TOOLS = [
  'web/fetch',
  'read/readFile', 'read/readDirectory', 'read/listDirectory',
  'edit/editFiles', 'edit/createFile', 'edit/deleteFile', 'edit/moveFile',
  'execute/runInTerminal'
];

/** Deprecated tool names that should not appear in tools arrays */
const DEPRECATED_TOOLS = [
  'readFile', 'editFile', 'createFile', 'deleteFile', 'moveFile',
  'findFiles', 'listDirectory', 'runInTerminal', 'fetchWebpage',
  'searchCodebase', 'searchFiles', 'runTests'
];

module.exports = { VALID_TOOLSETS, VALID_NAMESPACED_TOOLS, DEPRECATED_TOOLS };
```

### `lib/checks/agents.js` — Require Change

Replace the current constants block (lines 8–28):

```javascript
// CURRENT CODE — REMOVE THIS BLOCK:
/** Valid toolset names for agent tools arrays */
const VALID_TOOLSETS = ['read', 'search', 'edit', 'execute', 'web', 'todo', 'agent', 'vscode'];

/** Known valid namespaced tool identifiers */
const VALID_NAMESPACED_TOOLS = [
  'web/fetch',
  'read/readFile', 'read/readDirectory', 'read/listDirectory',
  'edit/editFiles', 'edit/createFile', 'edit/deleteFile', 'edit/moveFile',
  'execute/runInTerminal'
];

/** Deprecated tool names that should not appear in tools arrays */
const DEPRECATED_TOOLS = [
  'readFile', 'editFile', 'createFile', 'deleteFile', 'moveFile',
  'findFiles', 'listDirectory', 'runInTerminal', 'fetchWebpage',
  'searchCodebase', 'searchFiles', 'runTests'
];
```

With this single require:

```javascript
// NEW CODE — ADD THIS:
const { VALID_TOOLSETS, VALID_NAMESPACED_TOOLS, DEPRECATED_TOOLS } = require('../utils/constants');
```

The resulting top-of-file should look like:

```javascript
'use strict';

const path = require('path');
const { listFiles, readFile } = require('../utils/fs-helpers');
const { extractFrontmatter } = require('../utils/frontmatter');
const { VALID_TOOLSETS, VALID_NAMESPACED_TOOLS, DEPRECATED_TOOLS } = require('../utils/constants');
```

### `lib/checks/prompts.js` — Require Change

Replace the current constants block (lines 10–22):

```javascript
// CURRENT CODE — REMOVE THIS BLOCK:
/** Valid toolset names for prompt tools arrays (same as agents module) */
const VALID_TOOLSETS = ['read', 'search', 'edit', 'execute', 'web', 'todo', 'agent', 'vscode'];

/** Known valid namespaced tool identifiers (same as agents module) */
const VALID_NAMESPACED_TOOLS = [
  'web/fetch',
  'read/readFile', 'read/readDirectory', 'read/listDirectory',
  'edit/editFiles', 'edit/createFile', 'edit/deleteFile', 'edit/moveFile',
  'execute/runInTerminal'
];
```

With this single require:

```javascript
// NEW CODE — ADD THIS:
const { VALID_TOOLSETS, VALID_NAMESPACED_TOOLS } = require('../utils/constants');
```

The resulting top-of-file should look like:

```javascript
'use strict';

const path = require('path');
const { listFiles, readFile } = require('../utils/fs-helpers');
const { extractFrontmatter } = require('../utils/frontmatter');
const { VALID_TOOLSETS, VALID_NAMESPACED_TOOLS } = require('../utils/constants');
```

### `lib/utils/frontmatter.js` — Regex Change

```javascript
// CURRENT (line 31):
const fencedMatch = lines[0].match(/^```(chatagent|instructions|skill)\s*$/i);

// CHANGE TO:
const fencedMatch = lines[0].match(/^```(chatagent|instructions|skill|prompt)\s*$/i);
```

### `lib/checks/cross-refs.js` — Remove `checkSkillTemplateLinks`

Delete this entire function:

```javascript
// DELETE THIS FUNCTION (lines ~131–165):
/**
 * Validate that every template link in a skill's templateLinks[] array
 * resolves to an existing file on disk.
 * @param {string} basePath
 * @param {Map<string, object>} skills
 * @returns {Array<{category: string, name: string, status: string, message: string, detail?: object}>}
 */
function checkSkillTemplateLinks(basePath, skills) {
  const results = [];

  for (const [, info] of skills) {
    const links = Array.isArray(info.templateLinks) ? info.templateLinks : [];
    for (const linkTarget of links) {
      const resolvedPath = path.join(basePath, '.github', 'skills', info.folderName, linkTarget);
      if (exists(resolvedPath)) {
        results.push({
          category: CATEGORY,
          name: info.folderName,
          status: 'pass',
          message: `${info.folderName} → template "${linkTarget}" exists`,
        });
      } else {
        results.push({
          category: CATEGORY,
          name: info.folderName,
          status: 'fail',
          message: `${info.folderName} has broken template link: "${linkTarget}"`,
          detail: {
            expected: `File exists at ${resolvedPath}`,
            found: 'File not found',
          },
        });
      }
    }
  }

  return results;
}
```

And remove this line from the main export function body:

```javascript
// DELETE THIS LINE:
    results.push(...checkSkillTemplateLinks(basePath, skills));
```

After removal, the main export function should have these result pushes:

```javascript
    // 1. Orchestrator → agent references
    results.push(...checkOrchestratorAgentRefs(agents));

    // 2. Agent → skill references
    results.push(...checkAgentSkillRefs(agents, skills));

    // 3. Config path validation
    results.push(...checkConfigPaths(basePath, config));
```

### `lib/reporter.js` — Category Display Names

Add this map after the existing `HEADER_TEXT` constant (after line 68):

```javascript
const CATEGORY_DISPLAY_NAMES = {
  'structure': 'File Structure',
  'agents': 'Agents',
  'skills': 'Skills',
  'config': 'Configuration',
  'instructions': 'Instructions',
  'prompts': 'Prompts',
  'cross-references': 'Cross-References',
};
```

Then in the `renderCategoryBlock` function, resolve the display name at the top of the function body. Change the function signature line and add a mapping line:

```javascript
function renderCategoryBlock(category, items, t, m, sep, verbose) {
  const noColor = (t.reset === '');
  const displayName = CATEGORY_DISPLAY_NAMES[category] || category;
```

Then replace every reference to `category` in the rendering output within that function with `displayName`. Specifically these locations:

1. No-color header line: `writeln(sep.topLeft + ' ' + displayName + ' ' + ...)`
2. Color header `category.length` → `displayName.length`, and the category text itself → `displayName`
3. Category summary text: `const summaryText = displayName + ': ' + ...`

The `groupByOrdered` key function and `countByStatus` continue to use the raw `category` — only the **display** uses `displayName`.

## Styles & Design Tokens

*Not applicable — this is a CLI tool with no UI components.*

## Test Requirements

- [ ] Existing `agents.test.js` tests still pass after agents.js imports from constants.js (no behavior change)
- [ ] Existing `prompts.test.js` tests still pass after prompts.js imports from constants.js (no behavior change)
- [ ] Existing `cross-refs.test.js` tests still pass after removing `checkSkillTemplateLinks` (may need to remove/update tests that expect template link results from cross-refs category)
- [ ] Existing `frontmatter.test.js` tests still pass; add at least one new test that parses a ```` ```prompt ```` fenced block and confirms frontmatter is extracted
- [ ] Existing `reporter.test.js` tests still pass; verify output now shows display names (e.g., "File Structure" not "structure")
- [ ] All 11 existing test suites continue to pass with no regressions

## Acceptance Criteria

- [ ] `lib/utils/constants.js` exists and exports `VALID_TOOLSETS`, `VALID_NAMESPACED_TOOLS`, `DEPRECATED_TOOLS`
- [ ] `lib/checks/agents.js` imports all three constants from `../utils/constants` — no local definitions remain
- [ ] `lib/checks/prompts.js` imports `VALID_TOOLSETS` and `VALID_NAMESPACED_TOOLS` from `../utils/constants` — no local definitions remain
- [ ] `lib/utils/frontmatter.js` fenced regex matches `prompt` fence type (case-insensitive)
- [ ] `lib/checks/cross-refs.js` no longer contains `checkSkillTemplateLinks` function or its invocation
- [ ] `lib/reporter.js` maps raw category IDs to display names: structure→"File Structure", agents→"Agents", skills→"Skills", config→"Configuration", instructions→"Instructions", prompts→"Prompts", cross-references→"Cross-References"
- [ ] All tests pass
- [ ] No lint errors

## Constraints

- Do NOT add new validation checks — this task is strictly fixing identified review issues
- Do NOT modify the `CheckResult` shape or add new fields
- Do NOT change the module export signatures (`async function(basePath, context) → CheckResult[]`)
- Do NOT modify `validate-orchestration.js` (the entry point) — all changes are in lib/ modules
- Do NOT remove any existing test cases — only add or update tests as needed for the changes
- Preserve the `'use strict'` and CommonJS (`require`/`module.exports`) conventions in all files
