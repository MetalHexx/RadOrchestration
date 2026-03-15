---
project: "VALIDATOR"
phase: 1
task: 5
title: "File Structure Checks"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# File Structure Checks

## Objective

Create `lib/checks/structure.js` — the first check module that verifies the required `.github/` directories and files exist. This validates the end-to-end check module contract: an async function receiving `basePath` and `context`, returning `CheckResult[]`.

## Context

The VALIDATOR tool uses a modular check-runner architecture. Each check module in `lib/checks/` exports a single async function conforming to a shared contract. This module is the first check to be implemented. It depends on `lib/utils/fs-helpers.js` (already implemented) for all file system operations. The `context` parameter (DiscoveryContext) is passed through but NOT populated by this module — it is used by later check modules.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `lib/checks/structure.js` | First check module — file structure validation |

## Implementation Steps

1. Create `lib/checks/structure.js` with `'use strict';` header
2. Require dependencies: `const path = require('path');` and `const { exists, isDirectory } = require('../utils/fs-helpers');`
3. Define the main async function: `async function checkStructure(basePath, context)`
4. Inside the function, wrap all logic in a try/catch block. On catch, return a single fail result with `category: 'structure'`, `name: 'structure-check-error'`, `status: 'fail'`, and `message` containing the error message.
5. Build the `.github` base path: `const ghDir = path.join(basePath, '.github');`
6. Define the required directories to check as an array of objects:
   - `{ name: '.github', path: ghDir, check: 'isDirectory' }`
   - `{ name: '.github/agents', path: path.join(ghDir, 'agents'), check: 'isDirectory' }`
   - `{ name: '.github/skills', path: path.join(ghDir, 'skills'), check: 'isDirectory' }`
   - `{ name: '.github/instructions', path: path.join(ghDir, 'instructions'), check: 'isDirectory' }`
   - `{ name: '.github/prompts', path: path.join(ghDir, 'prompts'), check: 'isDirectory', optional: true }`
7. Define the required files to check as an array of objects:
   - `{ name: '.github/orchestration.yml', path: path.join(ghDir, 'orchestration.yml'), check: 'exists' }`
   - `{ name: '.github/copilot-instructions.md', path: path.join(ghDir, 'copilot-instructions.md'), check: 'exists' }`
8. Iterate over the directories array. For each entry:
   - If the check function returns `true`: push a CheckResult with `status: 'pass'` and message `"Directory exists: {name}"`
   - If the entry is `optional` and the check returns `false`: push a CheckResult with `status: 'warn'`, message `"Optional directory missing: {name}"`, and a `detail` object
   - If the check returns `false` (and not optional): push a CheckResult with `status: 'fail'`, message `"Required directory missing: {name}"`, and a `detail` object with `expected: 'Directory to exist'` and `found: 'Directory not found'`
9. Iterate over the files array. For each entry:
   - If the check function returns `true`: push a CheckResult with `status: 'pass'` and message `"File exists: {name}"`
   - If the check returns `false`: push a CheckResult with `status: 'fail'`, message `"Required file missing: {name}"`, and a `detail` object with `expected: 'File to exist'` and `found: 'File not found'`
10. Export the function: `module.exports = checkStructure;`

## Contracts & Interfaces

### CheckResult (return type for each check)

```typescript
interface CheckResult {
  /** Category grouping — always 'structure' for this module */
  category: string;
  /** Human-readable identifier (e.g., '.github/agents') */
  name: string;
  /** Outcome of this check */
  status: 'pass' | 'fail' | 'warn';
  /** One-line description of what was checked or what went wrong */
  message: string;
  /** Optional structured detail for verbose/failure output */
  detail?: CheckDetail;
}

interface CheckDetail {
  /** What the validator expected */
  expected: string;
  /** What was actually found */
  found: string;
  /** Optional additional context */
  context?: string;
}
```

### Check Module Signature (this module's export)

```typescript
/**
 * @param basePath - Absolute path to the workspace root (parent of .github/)
 * @param context  - Shared discovery context (not populated by this module)
 * @returns Array of CheckResult objects for the 'structure' category
 */
module.exports = async function checkStructure(basePath: string, context: DiscoveryContext): Promise<CheckResult[]>;
```

### DiscoveryContext (received but not mutated by this module)

```typescript
interface DiscoveryContext {
  agents: Map<string, AgentInfo>;
  skills: Map<string, SkillInfo>;
  config: Record<string, any> | null;
  instructions: InstructionInfo[];
  prompts: PromptInfo[];
}
```

### fs-helpers API (dependency — already implemented)

```javascript
const { exists, isDirectory } = require('../utils/fs-helpers');
```

- `exists(filePath: string): boolean` — Returns `true` if path exists (file or directory), `false` otherwise. Never throws.
- `isDirectory(dirPath: string): boolean` — Returns `true` if path exists and is a directory, `false` otherwise. Never throws.

These are the ONLY two functions needed from fs-helpers. Do NOT import `listFiles`, `listDirs`, or `readFile`.

## Styles & Design Tokens

Not applicable — this is a non-UI backend module. No ANSI codes or output formatting.

## Test Requirements

- [ ] Module exports an async function
- [ ] When run against a workspace with a full `.github/` structure, returns 7 CheckResult objects all with `status: 'pass'`
- [ ] When run against an empty directory (no `.github/`), returns results with `status: 'fail'` for required items and `status: 'warn'` for `.github/prompts`
- [ ] All results have `category: 'structure'`
- [ ] Fail/warn results include a `detail` object with `expected` and `found` strings
- [ ] Pass results do NOT include a `detail` object
- [ ] Function never throws — returns a fail result on unexpected error
- [ ] The `context` parameter is accepted but not modified

## Acceptance Criteria

- [ ] File `lib/checks/structure.js` exists and exports an async function
- [ ] Function signature matches: `async function checkStructure(basePath, context)` returning `CheckResult[]`
- [ ] Checks for all 7 items: `.github/`, `.github/agents/`, `.github/skills/`, `.github/instructions/`, `.github/prompts/`, `.github/orchestration.yml`, `.github/copilot-instructions.md`
- [ ] `.github/prompts/` uses `status: 'warn'` (not `'fail'`) when missing, since it is optional
- [ ] All other missing items use `status: 'fail'`
- [ ] Every result has `category: 'structure'`
- [ ] Fail and warn results include `detail` with `expected` and `found` fields
- [ ] Uses `require('../utils/fs-helpers')` — no direct `fs` module usage
- [ ] Uses `path.join()` for all path construction — no string concatenation for paths
- [ ] Function never throws — entire body is wrapped in try/catch
- [ ] All tests pass
- [ ] No lint errors

## Constraints

- Do NOT import or use the `fs` module directly — all file system access goes through `require('../utils/fs-helpers')`
- Do NOT import `listFiles`, `listDirs`, or `readFile` from fs-helpers — only `exists` and `isDirectory` are needed
- Do NOT modify `context` (DiscoveryContext) — this module reads `basePath` only
- Do NOT write to stdout or use any ANSI codes — this module returns data only
- Do NOT reference any external planning documents (Architecture, Design, Phase Plan)
- Do NOT add external dependencies — only `path` (built-in) and `../utils/fs-helpers`
- CommonJS format only — `require` / `module.exports`, no ES module syntax
