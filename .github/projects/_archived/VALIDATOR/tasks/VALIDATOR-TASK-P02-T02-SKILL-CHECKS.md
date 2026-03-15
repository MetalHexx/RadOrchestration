---
project: "VALIDATOR"
phase: 2
task: 2
title: "Skill Checks"
status: "pending"
skills_required: ["create-task-handoff"]
skills_optional: []
estimated_files: 2
---

# Skill Checks

## Objective

Create `lib/checks/skills.js` — the skill validation check module that scans `.github/skills/` for skill directories, validates `SKILL.md` presence and frontmatter, verifies directory structure (templates/ subdirectory), checks name-folder consistency, validates description length, resolves template links, and populates `context.skills` with `SkillInfo` entries. Create `tests/skills.test.js` with comprehensive test coverage.

## Context

This is Phase 2, Task 2 of the VALIDATOR project. The project is a zero-dependency Node.js CLI validator for `.github/` orchestration files. Phase 1 built core infrastructure: `fs-helpers.js` (file discovery), `frontmatter.js` (YAML frontmatter extraction), `yaml-parser.js`, `reporter.js`, `structure.js` (directory structure checks), and the CLI entry point. Task 1 of this phase created `agents.js` — follow its patterns for consistency. The module must conform to the `CheckFunction` contract and populate `context.skills`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `lib/checks/skills.js` | Skill validation check module |
| CREATE | `tests/skills.test.js` | Test suite using `node:test` with mocked dependencies |

## Implementation Steps

1. **Create `lib/checks/skills.js`** — require `path`, `fs-helpers` (`exists`, `isDirectory`, `listDirs`, `readFile`), and `frontmatter` (`extractFrontmatter`).

2. **Define constants** at the top of the module:
   - `const CATEGORY = 'skills';`
   - `const TEMPLATES_EXEMPT = ['run-tests'];` — skills that don't require a `templates/` subdirectory.

3. **Define helper: `parseTemplateLinks(body)`** — scan the SKILL.md body for markdown links targeting `./templates/` paths. Use regex pattern `/\[([^\]]*)\]\(\.\/templates\/([^)]+)\)/g` to extract link targets. Return an array of relative paths (e.g., `['./templates/PRD.md']`).

4. **Export async function `checkSkills(basePath, context)`** that:
   - Resolves `skillsDir = path.join(basePath, '.github', 'skills')`
   - Calls `listDirs(skillsDir)` to discover skill subdirectories
   - If no directories found, returns empty results array
   - Initializes `context.skills = new Map()` (if not already a Map)
   - Iterates over each directory name and runs validation steps 5–9

5. **For each skill directory — check SKILL.md exists**:
   - Build `skillMdPath = path.join(skillsDir, dirName, 'SKILL.md')`
   - Call `readFile(skillMdPath)` — if null, push a `fail` result (`"Missing SKILL.md"`) and `continue` to next directory

6. **Extract and validate frontmatter**:
   - Call `extractFrontmatter(content)` — if `frontmatter` is null, push `fail` (`"No frontmatter found in SKILL.md"`) and continue
   - Check `name` field: if missing or empty string → `fail` (`"Missing required field: name"`)
   - Check `description` field: if missing or empty string → `fail` (`"Missing required field: description"`)
   - Check name-folder match: if `frontmatter.name !== dirName` → `fail` (`"Skill name does not match folder name"`, detail: expected=dirName, found=frontmatter.name)
   - Check description length: if `description.length < 50 || description.length > 200` → `warn` (`"Description length outside recommended range (50-200 chars)"`, detail: expected="50-200 characters", found=`${description.length} characters`)

7. **Check templates/ subdirectory**:
   - Build `templatesPath = path.join(skillsDir, dirName, 'templates')`
   - If `dirName` is NOT in `TEMPLATES_EXEMPT`: check `isDirectory(templatesPath)` — if false → `fail` (`"Missing templates/ subdirectory"`)
   - (If exempt, skip this check — no pass or fail result for templates)

8. **Resolve template links**:
   - Call `parseTemplateLinks(body)` on the SKILL.md body text
   - For each link target, resolve to absolute path: `path.join(skillsDir, dirName, linkTarget)`
   - Call `exists(resolvedPath)` — if false → `fail` (`"Broken template link"`, detail: expected="file exists", found=linkTarget)

9. **Build SkillInfo and push pass result**:
   - Create a `SkillInfo` object: `{ folderName: dirName, frontmatter, hasTemplates: isDirectory(templatesPath), templateLinks }`
   - Set `context.skills.set(dirName, skillInfo)`
   - If no failures were produced for this skill, push a `pass` result (`"Valid skill"`)

10. **Wrap the entire function body in try/catch** — on unexpected error, return a single `fail` result with the error message (never throw/crash).

## Contracts & Interfaces

### CheckResult (every check function returns an array of these)

```javascript
// CheckResult object shape
{
  /** Category: 'skills' for this module */
  category: 'skills',
  /** Human-readable identifier — skill folder name (e.g., 'create-prd') */
  name: string,
  /** Outcome */
  status: 'pass' | 'fail' | 'warn',
  /** One-line description */
  message: string,
  /** Optional detail for verbose/failure output */
  detail: { expected: string, found: string, context?: string } | undefined
}
```

### CheckDetail

```javascript
{
  /** What the validator expected */
  expected: string,
  /** What was actually found */
  found: string,
  /** Optional additional context */
  context: string | undefined
}
```

### SkillInfo (stored in context.skills Map)

```javascript
{
  /** Folder name (e.g., 'create-prd') */
  folderName: string,
  /** Parsed SKILL.md frontmatter — Record<string, any> */
  frontmatter: object,
  /** Whether templates/ subdirectory exists */
  hasTemplates: boolean,
  /** Template link targets found in SKILL.md body (e.g., ['./templates/PRD.md']) */
  templateLinks: string[]
}
```

### DiscoveryContext (mutable context passed through pipeline)

```javascript
{
  agents: Map,        // Populated by checkAgents (already done)
  skills: Map,        // ← This module populates this: Map<string, SkillInfo>
  config: null,       // Populated by checkConfig (later)
  instructions: [],   // Populated by checkInstructions (later)
  prompts: []         // Populated by checkPrompts (later)
}
```

### CheckFunction signature (module.exports)

```javascript
/**
 * @param {string} basePath - Absolute path to workspace root (parent of .github/)
 * @param {object} context  - Shared DiscoveryContext
 * @returns {Promise<object[]>} Array of CheckResult objects
 */
module.exports = async function checkSkills(basePath, context) { ... };
```

### fs-helpers API (from `lib/utils/fs-helpers.js`)

```javascript
const { exists, isDirectory, listDirs, readFile } = require('../utils/fs-helpers');

// exists(filePath: string): boolean — true if path exists, never throws
// isDirectory(dirPath: string): boolean — true if path is a directory, never throws
// listDirs(dirPath: string): string[] — array of subdirectory names, empty array if dir doesn't exist
// readFile(filePath: string): string | null — file content as UTF-8, or null if unreadable
```

### frontmatter API (from `lib/utils/frontmatter.js`)

```javascript
const { extractFrontmatter } = require('../utils/frontmatter');

// extractFrontmatter(fileContent: string): { frontmatter: object | null, body: string }
// frontmatter is null if no valid frontmatter block found
// body is the content after the frontmatter block
```

## Real Workspace Examples

The `.github/skills/` directory contains these subdirectories:

```
.github/skills/
├── create-agent/          ← standard skill (has SKILL.md + templates/)
│   ├── SKILL.md
│   └── templates/
├── create-architecture/
│   ├── SKILL.md
│   └── templates/
├── create-design/
│   ├── SKILL.md
│   └── templates/
├── create-master-plan/
│   ├── SKILL.md
│   └── templates/
├── create-phase-plan/
│   ├── SKILL.md
│   └── templates/
├── create-prd/            ← example: standard skill
│   ├── SKILL.md
│   └── templates/
│       └── PRD.md
├── create-skill            ← ANOMALY: bare file, not a directory (skip — listDirs won't return it)
├── create-task-handoff/
│   ├── SKILL.md
│   └── templates/
│       └── TASK-HANDOFF.md
├── generate-phase-report/
│   ├── SKILL.md
│   └── templates/
├── generate-task-report/
│   ├── SKILL.md
│   └── templates/
├── research-codebase/
│   ├── SKILL.md
│   └── templates/
├── review-code/           ← example: standard skill
│   ├── SKILL.md
│   └── templates/
│       └── CODE-REVIEW.md
├── review-phase/
│   ├── SKILL.md
│   └── templates/
└── run-tests/             ← EXEMPT: no templates/ directory (by design)
    └── SKILL.md
```

### Example: `create-prd/SKILL.md` frontmatter

```yaml
---
name: create-prd
description: 'Create a Product Requirements Document (PRD) from research findings. Use when building a PRD, defining product requirements, writing user stories, specifying functional and non-functional requirements, or creating a requirements document for a new feature or project. Produces a structured PRD with problem statement, goals, user stories, requirements, risks, and success metrics.'
---
```

- `name` = `"create-prd"` → matches folder name ✅
- `description` length = 281 chars → outside 50–200 range → `warn`
- Template links in body: `[templates/PRD.md](./templates/PRD.md)` and `[PRD.md](./templates/PRD.md)` → resolve to `create-prd/templates/PRD.md` which exists ✅

### Example: `run-tests/SKILL.md` frontmatter

```yaml
---
name: run-tests
description: 'Run the project test suite and report results. Use when executing tests, running unit tests, integration tests, validating code changes, checking test coverage, or verifying acceptance criteria. Provides structured test execution with pass/fail reporting and error details.'
---
```

- `name` = `"run-tests"` → matches folder name ✅
- `description` length = 218 chars → outside 50–200 range → `warn`
- No `templates/` directory → EXEMPT (in `TEMPLATES_EXEMPT` list) → no fail
- No template links in body → no link resolution needed

### Example: `review-code/SKILL.md` frontmatter

```yaml
---
name: review-code
description: 'Review code changes after a coding task against the plan, architecture, and design. Use when performing code review, evaluating code quality, checking architectural consistency, validating design adherence, assessing test coverage, security review, or accessibility audit. Produces a structured review with verdicts, checklists, issues found, and recommendations.'
---
```

- `name` = `"review-code"` → matches folder name ✅
- Template links in body: `[templates/CODE-REVIEW.md](./templates/CODE-REVIEW.md)` and `[CODE-REVIEW.md](./templates/CODE-REVIEW.md)` → resolve to existing file ✅

## Styles & Design Tokens

Not applicable — this is a backend CLI module with no UI.

## Test Requirements

Create `tests/skills.test.js` using `node:test` (built-in) with `describe`/`it` blocks. Mock `fs-helpers` and `frontmatter` modules (same mocking pattern as `tests/agents.test.js`).

- [ ] `checkSkills` exports an async function
- [ ] No skills directory → returns empty results, `context.skills` is empty Map
- [ ] Valid skill (SKILL.md exists, name matches folder, has templates/) → 1 pass result, `context.skills` populated with correct `SkillInfo`
- [ ] Missing SKILL.md → 1 fail result ("Missing SKILL.md")
- [ ] Null frontmatter (no frontmatter block) → 1 fail result
- [ ] Missing `name` field → 1 fail result
- [ ] Missing `description` field → 1 fail result
- [ ] Name-folder mismatch (`name: "wrong"` in folder `create-prd`) → 1 fail result with detail showing expected vs found
- [ ] Description too short (< 50 chars) → 1 warn result
- [ ] Description too long (> 200 chars) → 1 warn result
- [ ] Description in range (50–200 chars) → no warn
- [ ] Missing `templates/` for non-exempt skill → 1 fail result
- [ ] Missing `templates/` for `run-tests` (exempt) → no fail result
- [ ] Template link resolves to existing file → no fail
- [ ] Template link resolves to non-existing file → 1 fail result ("Broken template link")
- [ ] Multiple skills → results for each, `context.skills` has all entries
- [ ] All results have `category: 'skills'`
- [ ] Function never throws — wraps errors in try/catch, returns fail result

## Acceptance Criteria

- [ ] `lib/checks/skills.js` exists and exports an async function matching `CheckFunction` signature
- [ ] All skill directories in `.github/skills/` are discovered via `listDirs`
- [ ] Missing `SKILL.md` produces `fail` result
- [ ] Missing/empty `name` or `description` frontmatter fields produce `fail` results
- [ ] Name-folder mismatch produces `fail` with `expected`/`found` in detail
- [ ] Description length outside 50–200 char range produces `warn`
- [ ] Missing `templates/` subdirectory produces `fail` (except for skills in `TEMPLATES_EXEMPT`)
- [ ] `run-tests` skill is correctly exempted from templates check
- [ ] Broken template links (SKILL.md body links to non-existent file) produce `fail`
- [ ] `context.skills` is populated as `Map<string, SkillInfo>` with correct entries
- [ ] Malformed/unparseable SKILL.md files produce `fail` results (no crash)
- [ ] All tests pass (`node --test tests/skills.test.js`)
- [ ] No lint errors
- [ ] Module requires cleanly (`node -e "require('./lib/checks/skills')"`)

## Constraints

- Do NOT import or require any external npm packages — only Node.js built-ins and project utility modules
- Do NOT modify any existing files — only create the two new files
- Do NOT read from `context.agents` or any other context section — this module only writes to `context.skills`
- Do NOT add `create-skill` (the bare file anomaly) handling — `listDirs` naturally skips files, so it won't appear
- Follow the same code style and patterns as `lib/checks/agents.js` (category constant, helper functions, try/catch wrapper, result building)
- Use `path.join()` for ALL path construction — no string concatenation with `/`
