---
project: "VALIDATOR"
phase: 2
task: 4
title: "Instruction & Prompt Checks"
status: "pending"
skills_required: ["generate-task-report"]
skills_optional: ["run-tests"]
estimated_files: 4
---

# Instruction & Prompt Checks

## Objective

Create `lib/checks/instructions.js` and `lib/checks/prompts.js` — two validation check modules that discover and validate `.instructions.md` and `.prompt.md` files respectively, enforce frontmatter requirements (FR-8 and FR-15), validate tool arrays in prompt files, and populate `context.instructions` and `context.prompts` in the shared discovery context. Create matching test suites `tests/instructions.test.js` and `tests/prompts.test.js`.

## Context

This is Phase 2, Task 4 of the VALIDATOR project. The project is a zero-dependency Node.js CLI validator for `.github/` orchestration files. Phase 1 built core infrastructure: `fs-helpers.js` (file discovery), `frontmatter.js` (frontmatter extraction), `yaml-parser.js`, `reporter.js`, `structure.js`, and the CLI entry point. Tasks 1–3 of this phase created `agents.js`, `skills.js`, and `config.js` — follow their patterns for consistency. Both modules use `fs-helpers.js` and `frontmatter.js` and must conform to the `CheckFunction` contract. The instruction files use fenced code block frontmatter format (` ```instructions ... ``` `), not standard `---` delimiters.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `lib/checks/instructions.js` | Instruction file validation check module |
| CREATE | `lib/checks/prompts.js` | Prompt file validation check module |
| CREATE | `tests/instructions.test.js` | Test suite for instructions module using `node:test` |
| CREATE | `tests/prompts.test.js` | Test suite for prompts module using `node:test` |

## Implementation Steps

### Part A: `lib/checks/instructions.js`

1. **Create `lib/checks/instructions.js`** — require `path`, `fs-helpers` (`listFiles`, `readFile`), and `frontmatter` (`extractFrontmatter`).

2. **Define constants** at the top of the module:
   ```javascript
   const CATEGORY = 'instructions';
   ```

3. **Export async function `checkInstructions(basePath, context)`** that:
   - Resolves `instrDir = path.join(basePath, '.github', 'instructions')`
   - Calls `listFiles(instrDir, '.instructions.md')` to discover all instruction files
   - If zero files found, initializes `context.instructions = []` and returns an empty array (no error)
   - Initializes `context.instructions = []`
   - For each discovered file:
     - Reads file content with `readFile(path.join(instrDir, filename))`
     - If content is null, emits a `fail` result (`"Could not read file"`) and continues
     - Calls `extractFrontmatter(content)` to parse frontmatter
     - If frontmatter is null, emits a `fail` result (`"No valid frontmatter found"`) and continues
     - Validates `applyTo` field: must be present and non-empty string. If missing/empty, emits `fail` with detail showing expected vs found
     - If all validations pass, emits a `pass` result
     - Pushes an `InstructionInfo` object to `context.instructions` regardless of validation outcome (so cross-refs can see all discovered files)
   - Wraps entire body in try/catch — on unexpected error, return a single `fail` result (never crash)
   - Returns all collected results

4. **Create `tests/instructions.test.js`** using `node:test` and `node:assert`:
   - Mock `fs-helpers` and `frontmatter` modules (same pattern as `agents.test.js` and `skills.test.js`)
   - Test cases:
     - Valid instruction file with `applyTo` → `pass` result, context populated
     - Missing `applyTo` field → `fail` result
     - Empty `applyTo` field → `fail` result
     - No frontmatter (returns null) → `fail` result
     - Unreadable file (readFile returns null) → `fail` result
     - Empty directory (zero files) → returns empty array, `context.instructions = []`
     - Multiple instruction files — all validated, all added to context
     - Unexpected error in module → returns `fail` (no crash)

### Part B: `lib/checks/prompts.js`

5. **Create `lib/checks/prompts.js`** — require `path`, `fs-helpers` (`listFiles`, `readFile`), and `frontmatter` (`extractFrontmatter`).

6. **Define constants** at the top of the module:
   ```javascript
   const CATEGORY = 'prompts';

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

7. **Export async function `checkPrompts(basePath, context)`** that:
   - Resolves `promptsDir = path.join(basePath, '.github', 'prompts')`
   - Calls `listFiles(promptsDir, '.prompt.md')` to discover all prompt files
   - If zero files found, initializes `context.prompts = []` and returns an empty array (no error)
   - Initializes `context.prompts = []`
   - For each discovered file:
     - Reads file content with `readFile(path.join(promptsDir, filename))`
     - If content is null, emits a `fail` result (`"Could not read file"`) and continues
     - Calls `extractFrontmatter(content)` to parse frontmatter
     - If frontmatter is null, emits a `fail` result (`"No valid frontmatter found"`) and continues
     - Validates `description` field (FR-15): must be present. If missing, emits `fail`
     - Validates `tools` array (FR-15): if `tools` is present in frontmatter, it must be an array. For each entry, validate against `VALID_TOOLSETS` and `VALID_NAMESPACED_TOOLS`. Invalid entries emit `fail` with detail showing the invalid tool name and valid options
     - If all validations pass, emits a `pass` result
     - Pushes a `PromptInfo` object to `context.prompts` regardless of validation outcome
   - Wraps entire body in try/catch — on unexpected error, return a single `fail` result (never crash)
   - Returns all collected results

8. **Create `tests/prompts.test.js`** using `node:test` and `node:assert`:
   - Mock `fs-helpers` and `frontmatter` modules
   - Test cases:
     - Valid prompt file with `description` and valid `tools` → `pass` result, context populated
     - Missing `description` field → `fail` result
     - Valid prompt without `tools` field → `pass` (tools are optional)
     - Invalid tool name in `tools` array → `fail` result with detail
     - Multiple invalid tools → multiple `fail` results
     - Valid toolset name in `tools` → `pass`
     - Valid namespaced tool in `tools` → `pass`
     - No frontmatter (returns null) → `fail` result
     - Unreadable file (readFile returns null) → `fail` result
     - Empty directory (zero files) → returns empty array, `context.prompts = []`
     - Multiple prompt files — all validated, all added to context
     - Unexpected error in module → returns `fail` (no crash)

## Contracts & Interfaces

### CheckResult (every check function returns an array of these)

```typescript
interface CheckResult {
  /** Category grouping */
  category: string;  // 'instructions' or 'prompts'
  /** Human-readable identifier — the filename */
  name: string;
  /** Outcome of this check */
  status: 'pass' | 'fail' | 'warn';
  /** One-line description of what was checked or what went wrong */
  message: string;
  /** Optional structured detail for verbose/failure output */
  detail?: CheckDetail;
}

interface CheckDetail {
  expected: string;
  found: string;
  context?: string;
}
```

### CheckFunction Contract

```typescript
type CheckFunction = (basePath: string, context: DiscoveryContext) => Promise<CheckResult[]>;
```

Each module's default export:

```typescript
// lib/checks/instructions.js
module.exports = async function checkInstructions(basePath: string, context: DiscoveryContext): Promise<CheckResult[]>;

// lib/checks/prompts.js
module.exports = async function checkPrompts(basePath: string, context: DiscoveryContext): Promise<CheckResult[]>;
```

### DiscoveryContext (relevant fields)

```typescript
interface DiscoveryContext {
  agents: Map<string, AgentInfo>;      // populated by checkAgents
  skills: Map<string, SkillInfo>;      // populated by checkSkills
  config: Record<string, any> | null;  // populated by checkConfig
  instructions: InstructionInfo[];     // populated by checkInstructions (THIS TASK)
  prompts: PromptInfo[];               // populated by checkPrompts (THIS TASK)
}
```

### InstructionInfo

```typescript
interface InstructionInfo {
  /** Filename (e.g., 'project-docs.instructions.md') */
  filename: string;
  /** Parsed frontmatter */
  frontmatter: Record<string, any>;
}
```

### PromptInfo

```typescript
interface PromptInfo {
  /** Filename (e.g., 'configure-system.prompt.md') */
  filename: string;
  /** Parsed frontmatter */
  frontmatter: Record<string, any>;
}
```

### fs-helpers API (used by both modules)

```typescript
function listFiles(dirPath: string, suffix?: string): string[];
// Returns filenames (not full paths). Empty array if dir doesn't exist.

function readFile(filePath: string): string | null;
// Returns content or null. Never throws.
```

### frontmatter API

```typescript
function extractFrontmatter(fileContent: string): { frontmatter: Record<string, any> | null; body: string };
// Handles both ---/--- delimited and fenced code block formats (```instructions, ```prompt)
// Returns { frontmatter: null, body } if no valid block found
```

### Tool Validation Constants (for prompts.js)

```javascript
const VALID_TOOLSETS = ['read', 'search', 'edit', 'execute', 'web', 'todo', 'agent', 'vscode'];

const VALID_NAMESPACED_TOOLS = [
  'web/fetch',
  'read/readFile', 'read/readDirectory', 'read/listDirectory',
  'edit/editFiles', 'edit/createFile', 'edit/deleteFile', 'edit/moveFile',
  'execute/runInTerminal'
];
```

## Real Workspace Examples

### Instruction files in `.github/instructions/`

There are 2 instruction files:

**`project-docs.instructions.md`** — uses fenced ` ```instructions ` format:
```
```instructions
---
applyTo: '.github/projects/**'
---
```
Frontmatter has `applyTo` field with a glob pattern value.

**`state-management.instructions.md`** — uses fenced ` ```instructions ` format:
```
```instructions
---
applyTo: '**/state.json,**/*STATUS.md'
---
```
Frontmatter has `applyTo` field with a comma-separated glob pattern value.

### Prompt files in `.github/prompts/`

There is 1 prompt file:

**`configure-system.prompt.md`** — uses fenced ` ```prompt ` format:
```
```prompt
---
description: "Configure the orchestration system..."
agent: agent
tools:
  - read
  - edit
  - search
---
```
Frontmatter has `description` (string), `agent` (string — not validated by this module), and `tools` (array of toolset names).

## Styles & Design Tokens

Not applicable — backend CLI modules with no UI.

## Test Requirements

### `tests/instructions.test.js`

- [ ] Valid instruction file with `applyTo` produces `pass` result
- [ ] `context.instructions` is populated with correct `InstructionInfo` entry
- [ ] Missing `applyTo` field produces `fail` with detail `{expected: "non-empty 'applyTo'...", found: "undefined"}`
- [ ] Empty string `applyTo` produces `fail`
- [ ] File with no parseable frontmatter produces `fail`
- [ ] Unreadable file (readFile returns null) produces `fail`
- [ ] Empty directory returns `[]` and sets `context.instructions = []`
- [ ] Multiple files — each validated independently, all added to context
- [ ] Unexpected thrown error returns `fail` result (no unhandled exception)

### `tests/prompts.test.js`

- [ ] Valid prompt file with `description` and valid `tools` produces `pass` result
- [ ] `context.prompts` is populated with correct `PromptInfo` entry
- [ ] Missing `description` field produces `fail`
- [ ] Prompt without `tools` field (optional) still produces `pass`
- [ ] Invalid tool name in `tools` produces `fail` with valid tool list in `detail.context`
- [ ] Valid toolset name (`read`, `edit`, etc.) in tools passes
- [ ] Valid namespaced tool (`web/fetch`, etc.) in tools passes
- [ ] Multiple invalid tools produce multiple `fail` results
- [ ] File with no parseable frontmatter produces `fail`
- [ ] Unreadable file produces `fail`
- [ ] Empty directory returns `[]` and sets `context.prompts = []`
- [ ] Multiple files — each validated, all added to context
- [ ] Unexpected thrown error returns `fail` result (no unhandled exception)

## Acceptance Criteria

- [ ] `lib/checks/instructions.js` exists and exports an async function `checkInstructions(basePath, context)`
- [ ] `lib/checks/prompts.js` exists and exports an async function `checkPrompts(basePath, context)`
- [ ] Instructions module discovers all `.instructions.md` files in `.github/instructions/`
- [ ] Instructions module validates `applyTo` field presence and non-emptiness (FR-8)
- [ ] Instructions module populates `context.instructions` with `InstructionInfo` objects
- [ ] Prompts module discovers all `.prompt.md` files in `.github/prompts/`
- [ ] Prompts module validates `description` field presence (FR-15)
- [ ] Prompts module validates `tools` array entries against `VALID_TOOLSETS` and `VALID_NAMESPACED_TOOLS` (FR-15)
- [ ] Prompts module populates `context.prompts` with `PromptInfo` objects
- [ ] Both modules return `CheckResult[]` with `category` set to `'instructions'` or `'prompts'`
- [ ] Both modules handle empty directories gracefully (return `[]`, no error)
- [ ] Both modules handle unreadable/malformed files gracefully (emit `fail`, no crash)
- [ ] `tests/instructions.test.js` passes with all test cases
- [ ] `tests/prompts.test.js` passes with all test cases
- [ ] All existing tests (Phase 1 + Phase 2 T1–T3) still pass
- [ ] No lint errors

## Constraints

- Do NOT use any external npm dependencies — only Node.js built-in modules
- Do NOT modify any existing files — only create the 4 new files listed in File Targets
- Do NOT add deprecated tool detection to the prompts module — only `VALID_TOOLSETS` and `VALID_NAMESPACED_TOOLS` validation (deprecated tools are an agents-only concern)
- Do NOT validate the `agent` field in prompt frontmatter — that is not required by FR-15
- Follow the same module structure pattern as `lib/checks/agents.js` and `lib/checks/skills.js`
- Use `'use strict';` at the top of all files
- Use `node:test` and `node:assert` for test files (same as existing test suites)
- Mock `fs-helpers` and `frontmatter` in tests — do NOT perform real file I/O in tests
