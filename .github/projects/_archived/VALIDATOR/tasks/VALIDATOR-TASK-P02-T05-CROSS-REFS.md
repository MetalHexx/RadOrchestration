---
project: "VALIDATOR"
phase: 2
task: 5
title: "Cross-Reference Checks"
status: "pending"
skills_required: ["generate-task-report"]
skills_optional: ["run-tests"]
estimated_files: 2
---

# Cross-Reference Checks

## Objective

Create `lib/checks/cross-refs.js` — a validation check module that reads the shared `DiscoveryContext` populated by earlier checks (agents, skills, config, instructions, prompts) and validates cross-references between orchestration files: Orchestrator agent subagent references, agent-to-skill references, skill-to-template link resolution, and config path validation. Create a matching test suite `tests/cross-refs.test.js`.

## Context

This is Phase 2, Task 5 of the VALIDATOR project. The project is a zero-dependency Node.js CLI validator for `.github/` orchestration files. Tasks 1–4 of this phase built check modules that populate the `DiscoveryContext`: `agents.js` populates `context.agents` (a `Map<string, AgentInfo>`), `skills.js` populates `context.skills` (a `Map<string, SkillInfo>`), `config.js` populates `context.config` (a nested object), and `instructions.js`/`prompts.js` populate `context.instructions`/`context.prompts`. This module READS from all context sections but does NOT write to any — it only produces `CheckResult[]` results. It uses `fs-helpers.exists()` for file existence checks.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `lib/checks/cross-refs.js` | Cross-reference validation check module |
| CREATE | `tests/cross-refs.test.js` | Test suite using `node:test` |

## Implementation Steps

1. **Create `lib/checks/cross-refs.js`** — require `path` and `fs-helpers` (`exists`).

2. **Define constants** at the top of the module:
   ```javascript
   const CATEGORY = 'cross-references';
   ```

3. **Implement helper: `checkOrchestratorAgentRefs(context)`** — finds the Orchestrator agent in `context.agents`, validates every entry in its `agents[]` array matches a `name` field from another agent in `context.agents`. Returns `CheckResult[]`.
   - Iterate over `context.agents` entries to find the agent whose `frontmatter.name === 'Orchestrator'`
   - If no Orchestrator found, return a single `warn` result: `"No Orchestrator agent found — cannot validate agent references"`
   - For each entry in the Orchestrator's `agents[]` array:
     - Search `context.agents` for any agent whose `frontmatter.name` exactly equals the reference
     - If found → emit `pass` result: `"Orchestrator → {name} reference valid"`
     - If not found → emit `fail` result: `"Orchestrator references unknown agent: {name}"` with detail showing expected (a name from a discovered agent) and found (the unresolved name)

4. **Implement helper: `checkAgentSkillRefs(context)`** — for each agent's `referencedSkills` array, verifies the skill name exists as a key in `context.skills`. Returns `CheckResult[]`.
   - Iterate over all agents in `context.agents`
   - For each agent that has `referencedSkills.length > 0`:
     - For each skill name in `referencedSkills`:
       - If `context.skills.has(skillName)` → emit `pass`: `"{agentFilename} → skill "{skillName}" reference valid"`
       - Else → emit `fail`: `"{agentFilename} references unknown skill: "{skillName}""` with detail showing valid skill names from `context.skills`

5. **Implement helper: `checkSkillTemplateLinks(basePath, context)`** — for each skill's `templateLinks` array, verifies the linked file exists on disk. Returns `CheckResult[]`.
   - Iterate over all skills in `context.skills`
   - For each skill that has `templateLinks.length > 0`:
     - For each link target (e.g., `'./templates/PRD.md'`):
       - Resolve the absolute path: `path.join(basePath, '.github', 'skills', skill.folderName, linkTarget)`
       - If `exists(resolvedPath)` → emit `pass`: `"{folderName} → template "{linkTarget}" exists"`
       - Else → emit `fail`: `"{folderName} has broken template link: "{linkTarget}""` with detail showing expected (file exists at resolved path) and found (file not found)

6. **Implement helper: `checkConfigPaths(basePath, context)`** — validates `projects.base_path` from `context.config`. Returns `CheckResult[]`.
   - If `context.config` is null/undefined, return empty array (config check failed earlier; don't duplicate errors)
   - Extract `basePath` value: `context.config.projects && context.config.projects.base_path`
   - If `base_path` is not set, return empty array (missing field was already flagged by config checks)
   - Resolve to absolute path: `path.join(basePath, configBasePath)` (where `basePath` is the workspace root parameter, and `configBasePath` is the value from config)
   - If `exists(resolvedConfigPath)` → emit `pass`: `"Config projects.base_path resolves to existing path"`
   - Else → emit `warn`: `"Config projects.base_path does not resolve to existing directory"` with detail showing expected (existing directory) and found (the resolved path)

7. **Export async function `checkCrossRefs(basePath, context)`** that:
   - Initializes an empty `results` array
   - Gracefully handles null/empty context sections (if a prior check module failed):
     - If `context.agents` is not a `Map` or is undefined, set it to `new Map()` locally (do NOT mutate context)
     - If `context.skills` is not a `Map` or is undefined, set it to `new Map()` locally
     - If `context.config` is null/undefined, keep as-is (helpers handle this)
   - Calls each helper in order and pushes results:
     1. `checkOrchestratorAgentRefs(context)` → push to results
     2. `checkAgentSkillRefs(context)` → push to results
     3. `checkSkillTemplateLinks(basePath, context)` → push to results
     4. `checkConfigPaths(basePath, context)` → push to results
   - Wraps entire body in try/catch — on unexpected error, return a single `fail` result (never crash)
   - Returns all collected results

8. **Create `tests/cross-refs.test.js`** using `node:test` and `node:assert`:
   - Mock `fs-helpers` module (same pattern as other test files in this project)
   - Build mock `DiscoveryContext` objects with controlled data for each test
   - Test cases detailed in the Test Requirements section below

## Contracts & Interfaces

### CheckResult (every check function returns an array of these)

```typescript
interface CheckResult {
  /** Category grouping */
  category: 'cross-references';
  /** Human-readable identifier — typically agent/skill filename or config path */
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

Module default export:

```typescript
// lib/checks/cross-refs.js
module.exports = async function checkCrossRefs(basePath: string, context: DiscoveryContext): Promise<CheckResult[]>;
```

### DiscoveryContext (full interface — all fields)

```typescript
interface DiscoveryContext {
  /** Map of agent filename → parsed agent metadata. Populated by checkAgents. */
  agents: Map<string, AgentInfo>;
  /** Map of skill folder name → parsed skill metadata. Populated by checkSkills. */
  skills: Map<string, SkillInfo>;
  /** Parsed orchestration.yml content. Populated by checkConfig. Null if parsing failed. */
  config: Record<string, any> | null;
  /** List of discovered instruction files with metadata. Populated by checkInstructions. */
  instructions: InstructionInfo[];
  /** List of discovered prompt files with metadata. Populated by checkPrompts. */
  prompts: PromptInfo[];
}
```

### AgentInfo (populated by `checkAgents` into `context.agents`)

```typescript
interface AgentInfo {
  /** Filename (e.g., 'orchestrator.agent.md') */
  filename: string;
  /** Parsed frontmatter fields */
  frontmatter: Record<string, any>;
  /** Extracted tools array (e.g., ['read', 'search', 'agent']) */
  tools: string[];
  /** Extracted agents array (e.g., ['Research', 'Product Manager', 'Coder']) — names, not filenames */
  agents: string[];
  /** Skill names referenced in agent body's ## Skills section (e.g., ['create-prd', 'research-codebase']) */
  referencedSkills: string[];
}
```

### SkillInfo (populated by `checkSkills` into `context.skills`)

```typescript
interface SkillInfo {
  /** Folder name (e.g., 'create-prd') — this is the Map key */
  folderName: string;
  /** Parsed SKILL.md frontmatter */
  frontmatter: Record<string, any>;
  /** Whether templates/ subdirectory exists */
  hasTemplates: boolean;
  /** Template link targets found in SKILL.md body (e.g., ['./templates/PRD.md']) */
  templateLinks: string[];
}
```

### InstructionInfo (populated by `checkInstructions` into `context.instructions`)

```typescript
interface InstructionInfo {
  /** Filename (e.g., 'project-docs.instructions.md') */
  filename: string;
  /** Parsed frontmatter */
  frontmatter: Record<string, any>;
}
```

### PromptInfo (populated by `checkPrompts` into `context.prompts`)

```typescript
interface PromptInfo {
  /** Filename (e.g., 'configure-system.prompt.md') */
  filename: string;
  /** Parsed frontmatter */
  frontmatter: Record<string, any>;
}
```

### fs-helpers API (used by this module)

```typescript
/**
 * Check if a path exists (file or directory).
 * @returns true if path exists, false otherwise. Never throws.
 */
function exists(filePath: string): boolean;
```

Usage: `const { exists } = require('../utils/fs-helpers');`

## Styles & Design Tokens

Not applicable — this is a CLI validation module with no UI.

## Test Requirements

- [ ] **Valid Orchestrator agent refs**: Orchestrator `agents: ['Research', 'Coder']` and both exist in `context.agents` → 2 `pass` results
- [ ] **Broken Orchestrator agent ref**: Orchestrator `agents: ['NonExistent']` and no matching agent → 1 `fail` result with detail
- [ ] **No Orchestrator found**: `context.agents` has no agent with name 'Orchestrator' → 1 `warn` result
- [ ] **Valid agent → skill refs**: Agent has `referencedSkills: ['create-prd']` and `context.skills` has key `'create-prd'` → 1 `pass` result
- [ ] **Broken agent → skill ref**: Agent has `referencedSkills: ['nonexistent-skill']` and `context.skills` lacks that key → 1 `fail` result
- [ ] **Valid skill template links**: Skill has `templateLinks: ['./templates/PRD.md']`, `exists()` returns true → 1 `pass` result
- [ ] **Broken skill template link**: Skill has `templateLinks: ['./templates/MISSING.md']`, `exists()` returns false → 1 `fail` result
- [ ] **Config base_path exists**: `context.config.projects.base_path` is `.github/projects/` and `exists()` returns true → 1 `pass`
- [ ] **Config base_path missing dir**: `context.config.projects.base_path` points to nonexistent dir, `exists()` returns false → 1 `warn`
- [ ] **Config is null**: `context.config` is null → zero results from config path check (no error)
- [ ] **Empty context.agents (null/undefined)**: Does not crash, treats as empty Map
- [ ] **Empty context.skills (null/undefined)**: Does not crash, treats as empty Map
- [ ] **Agent with empty referencedSkills**: No skill-ref results emitted for that agent
- [ ] **Skill with empty templateLinks**: No template-link results emitted for that skill
- [ ] **Orchestrator with empty agents array**: No agent-ref results emitted (array is valid but empty)
- [ ] **Unexpected error**: Module catches exception and returns a `fail` result (no unhandled crash)
- [ ] **Multiple cross-reference types together**: Combined context with agents, skills, and config — all checks produce correct aggregate results

## Acceptance Criteria

- [ ] `lib/checks/cross-refs.js` exports async function `checkCrossRefs(basePath, context)`
- [ ] Function returns `CheckResult[]` with `category: 'cross-references'` for every result
- [ ] Broken Orchestrator → agent references produce `fail` results
- [ ] Broken agent → skill references produce `fail` results
- [ ] Broken skill → template links produce `fail` results
- [ ] Invalid config `base_path` produces `warn` result
- [ ] All valid cross-references produce `pass` results
- [ ] Null/undefined/non-Map context sections are handled gracefully (no crash)
- [ ] Empty arrays (`agents: []`, `referencedSkills: []`, `templateLinks: []`) produce zero results (not errors)
- [ ] Module never throws an unhandled exception — all errors caught and returned as `fail` CheckResult
- [ ] All tests pass (`node --test tests/cross-refs.test.js`)
- [ ] Build succeeds (`node -c lib/checks/cross-refs.js` — syntax check)
- [ ] No lint errors

## Constraints

- Do NOT write to or modify `context` — this module is read-only on the DiscoveryContext
- Do NOT import `frontmatter.js` or `yaml-parser.js` — this module only reads from context, not from raw files (except `exists()` for path checks)
- Do NOT duplicate checks already performed by agents.js, skills.js, or config.js — this module only validates cross-references between them
- Do NOT use any external dependencies — only Node.js built-in modules (`path`) and internal utilities (`fs-helpers`)
- Follow the same code style and patterns established by `agents.js`, `skills.js`, `config.js`, `instructions.js`, and `prompts.js`
- Use `node:test` and `node:assert` for tests — same as all other test files in this project
