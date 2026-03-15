---
project: "VALIDATOR"
phase: 2
task: 1
title: "Agent Checks"
status: "pending"
skills_required: ["generate-task-report"]
skills_optional: ["run-tests"]
estimated_files: 2
---

# Agent Checks

## Objective

Create `lib/checks/agents.js` — the check module that validates all `.agent.md` files in `.github/agents/`. The module scans for agent files, extracts frontmatter, validates required fields and tool/agent arrays, populates `context.agents` with `AgentInfo` entries, and returns structured `CheckResult[]` results.

## Context

This is a check module in a modular CLI validator (`validate-orchestration.js`). Phase 1 built the infrastructure: `lib/utils/fs-helpers.js` (file system helpers), `lib/utils/frontmatter.js` (YAML frontmatter extractor), `lib/reporter.js` (output renderer), and `lib/checks/structure.js` (structural checks). This module plugs into the same pipeline — it receives `(basePath, context)`, runs validation logic, populates `context.agents`, and returns `CheckResult[]`. The entry point calls check modules in sequence; `checkAgents` runs second (after `checkStructure`). A later cross-references module will read `context.agents` to validate inter-file links.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `lib/checks/agents.js` | Agent validation check module |
| CREATE | `tests/agents.test.js` | Test suite for the agent checks module |

## Implementation Steps

1. **Create `lib/checks/agents.js`** with the required imports and constants (see Contracts section below).

2. **Define the constants** at the top of the module — `VALID_TOOLSETS`, `VALID_NAMESPACED_TOOLS`, and `DEPRECATED_TOOLS` (exact values provided in Constants section below).

3. **Implement the exported `checkAgents(basePath, context)` function**:
   - Build the agents directory path: `path.join(basePath, '.github', 'agents')`
   - Use `listFiles(agentsDir, '.agent.md')` to discover all agent files
   - If the directory is empty or missing, return an empty results array (no crash)
   - Initialize `context.agents` as a `new Map()`
   - For each agent file, call a helper function `validateAgent(filePath, filename, context)` and collect results

4. **Implement `validateAgent(filePath, filename, context)`** — returns `CheckResult[]` for one agent:
   - Read file content with `readFile(filePath)`. If null, return a single `fail` result ("Could not read file")
   - Extract frontmatter with `extractFrontmatter(content)`. If frontmatter is null, return a single `fail` result ("No valid frontmatter found")
   - Validate required fields: `name` (non-empty string), `description` (non-empty string), `tools` (array with at least one entry). For each missing/empty field, push a `fail` result
   - Check that `agents` field is present (it may be an empty array — that is valid). If missing entirely, push a `fail` result
   - Normalize the `tools` field: if it's a string, wrap in array; if not an array, push `fail`
   - Normalize the `agents` field: if it's a string, wrap in array; if not present, default to `[]`
   - Call `validateTools(tools, filename)` to check tool entries — collect results
   - Call `validateAgentsArray(agents, tools, name, filename)` to check agent array consistency — collect results
   - Parse `referencedSkills` from the body (see step 6)
   - Build an `AgentInfo` object and set `context.agents.set(filename, agentInfo)`
   - If all required fields are present and valid, push a `pass` result for the agent

5. **Implement `validateTools(tools, filename)`** — returns `CheckResult[]`:
   - For each entry in the `tools` array:
     - If the entry is in `DEPRECATED_TOOLS`, push a `warn` result with detail: expected = "a current tool name", found = the deprecated name, context = "Deprecated tools list: ..." 
     - Else if the entry is in `VALID_TOOLSETS` or `VALID_NAMESPACED_TOOLS`, it's valid (no result needed)
     - Else push a `fail` result with detail: expected = "a valid toolset or namespaced tool", found = the invalid name, context = list of valid toolsets

6. **Implement `validateAgentsArray(agents, tools, agentName, filename)`** — returns `CheckResult[]`:
   - If `agents.length > 0` and `!tools.includes('agent')`, push a `fail`: agents array is non-empty but `agent` toolset is missing from tools
   - If `agents.length > 0` and `agentName !== 'Orchestrator'`, push a `fail`: only the Orchestrator may have a non-empty agents array
   - (Do NOT validate that agent names in the array match real agents — that is the cross-references module's job)

7. **Implement `parseReferencedSkills(body)`** — returns `string[]`:
   - Find the `## Skills` section in the body text
   - Match all skill names using the pattern: lines containing `` **`skill-name`** `` — extract the text between the backticks
   - Return the array of skill name strings (may be empty)

8. **Create `tests/agents.test.js`** with comprehensive test coverage (see Test Requirements below). Use Node.js built-in `node:test` and `node:assert` modules. Mock `fs-helpers` and `frontmatter` functions to avoid real file system access.

9. **Verify** that `lib/checks/agents.js` can be required without errors: `node -e "require('./lib/checks/agents')"` should exit cleanly.

10. **Run the full test suite**: `node --test tests/agents.test.js` — all tests must pass.

## Contracts & Interfaces

### Module Signature

```javascript
// lib/checks/agents.js
// Export signature:
module.exports = async function checkAgents(basePath, context) {
  // basePath: string — absolute path to workspace root (parent of .github/)
  // context: DiscoveryContext — mutable shared context object
  // Returns: CheckResult[]
};
```

### CheckResult

```javascript
// Every result object must have this shape:
{
  category: 'agents',              // Always 'agents' for this module
  name: 'orchestrator.agent.md',   // The filename being checked
  status: 'pass' | 'fail' | 'warn',
  message: 'Description of what was checked or what went wrong',
  detail: {                        // Optional — include for fail/warn, useful for pass in verbose mode
    expected: 'What the validator expected',
    found: 'What was actually found',
    context: 'Optional additional context'  // Optional field
  }
}
```

### CheckDetail

```javascript
{
  expected: string,   // What the validator expected
  found: string,      // What was actually found
  context?: string    // Optional additional context (e.g., list of valid values)
}
```

### AgentInfo (stored in context.agents Map)

```javascript
// Each entry in context.agents is keyed by filename:
// context.agents.set('orchestrator.agent.md', agentInfo)
{
  filename: 'orchestrator.agent.md',      // The .agent.md filename
  frontmatter: { /* raw parsed frontmatter object */ },
  tools: ['read', 'search', 'agent'],     // Extracted tools array
  agents: ['Research', 'Product Manager', 'UX Designer', ...], // Extracted agents array
  referencedSkills: ['create-architecture', 'create-master-plan'] // Skills from ## Skills section
}
```

### DiscoveryContext (passed in, mutated by this module)

```javascript
// The context object has this shape when received:
{
  agents: Map,          // Empty Map — this module populates it
  skills: Map,          // Empty Map — populated by skills check module later
  config: null,         // null — populated by config check module later
  instructions: [],     // Empty array — populated by instructions check module later
  prompts: []           // Empty array — populated by prompts check module later
}
```

### Dependency: fs-helpers API

```javascript
const { exists, isDirectory, listFiles, readFile } = require('../utils/fs-helpers');

// listFiles(dirPath: string, suffix?: string): string[]
//   Returns array of filenames (not full paths) matching suffix. Empty array if dir missing.

// readFile(filePath: string): string | null
//   Returns file content as UTF-8 string, or null on failure. Never throws.

// exists(filePath: string): boolean
//   Returns true if path exists. Never throws.

// isDirectory(dirPath: string): boolean
//   Returns true if path exists and is a directory. Never throws.
```

### Dependency: frontmatter API

```javascript
const { extractFrontmatter } = require('../utils/frontmatter');

// extractFrontmatter(fileContent: string): { frontmatter: Record<string, any> | null, body: string }
//   Handles two formats:
//     1. Standard --- delimited frontmatter at file start
//     2. Fenced code block (```chatagent ... ```) with --- delimiters inside
//   Returns frontmatter as parsed key-value object (arrays are parsed for list fields like tools/agents).
//   Returns null frontmatter if no valid block found or parse error.
//   body is the content after the frontmatter block.
```

## Constants

Place these at the top of `lib/checks/agents.js`:

```javascript
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

## Real Agent File Examples

Agent files use fenced code block frontmatter (` ```chatagent ` opening fence). Here are representative examples from the live workspace:

### Example 1: Orchestrator (has agents, uses `agent` toolset)

```
` ` `chatagent
---
name: Orchestrator
description: "The main orchestration agent that coordinates the entire project pipeline..."
argument-hint: "Describe the project to start, or ask to continue an existing project."
tools:
  - read
  - search
  - agent
agents:
  - Research
  - Product Manager
  - UX Designer
  - Architect
  - Tactical Planner
  - Coder
  - Reviewer
---

# Orchestrator
...

## Skills

(no skills section — Orchestrator delegates to agents, not skills directly)
` ` `
```

### Example 2: Coder (empty agents, uses `execute` toolset)

```
` ` `chatagent
---
name: Coder
description: "Execute coding tasks from self-contained Task Handoff documents..."
argument-hint: "Provide the path to the task handoff document to execute."
tools:
  - read
  - search
  - edit
  - execute
  - todo
agents: []
---

# Coder Agent
...

## Skills

- **`generate-task-report`**: Guides Task Report creation and provides template
- **`run-tests`**: Guides test runner discovery and execution across project types
` ` `
```

### Example 3: Research (namespaced tool `web/fetch`)

```
` ` `chatagent
---
name: Research
description: "Research and explore codebases, documentation, and external sources..."
argument-hint: "Provide the project idea or topic to research."
tools:
  - read
  - search
  - edit
  - web/fetch
  - todo
agents: []
---

# Research Agent
...

## Skills

- **`research-codebase`**: Primary skill — guides research workflow and provides the Research Findings template
` ` `
```

**Key observations**:
- All agent files use ` ```chatagent ` fenced frontmatter (NOT standard `---` at file start)
- `tools` is always a YAML list (` - item` format)
- `agents` is a YAML list — empty (`[]`) for all agents except Orchestrator
- `argument-hint` is always present but is NOT a required field for validation
- The `## Skills` section uses format: `- **` `` `skill-name` `` `**: description text`
- The Orchestrator has NO `## Skills` section — it references agents, not skills

## Styles & Design Tokens

Not applicable — this is a Node.js module, not a UI component.

## Test Requirements

Create `tests/agents.test.js` using `node:test` and `node:assert`. Mock `fs-helpers` and `frontmatter` to provide controlled inputs.

- [ ] **Valid agent file**: Provide a well-formed agent with all required fields, valid tools, empty agents array, and a `## Skills` section. Expect: 1 `pass` result, `context.agents` populated with correct `AgentInfo`
- [ ] **Missing required fields**: Provide frontmatter missing `name`, `description`, and `tools`. Expect: 3 `fail` results (one per missing field)
- [ ] **Empty required fields**: Provide frontmatter with `name: ""`, `description: ""`, `tools: []`. Expect: `fail` results for empty name, empty description, empty tools
- [ ] **Invalid tool name**: Provide tools array with `['read', 'invalidTool']`. Expect: 1 `fail` result for `invalidTool` with detail showing valid toolsets
- [ ] **Deprecated tool name**: Provide tools array with `['read', 'readFile']`. Expect: 1 `warn` result for `readFile`
- [ ] **Namespaced tool**: Provide tools array with `['read', 'web/fetch']`. Expect: all valid, no fail/warn for tools
- [ ] **Non-Orchestrator with non-empty agents**: Provide agent named "Coder" with `agents: ['Research']`. Expect: `fail` (only Orchestrator may have non-empty agents)
- [ ] **Non-empty agents without agent toolset**: Provide Orchestrator-named agent with `agents: ['Research']` but `tools: ['read', 'search']` (no `agent`). Expect: `fail` (agents array requires `agent` in tools)
- [ ] **Orchestrator with valid agents**: Provide agent named "Orchestrator" with `tools: ['read', 'search', 'agent']` and `agents: ['Research', 'Coder']`. Expect: no agents-array-related `fail`
- [ ] **Malformed file — null content**: Mock `readFile` returning null. Expect: 1 `fail` result ("Could not read file"), no crash
- [ ] **Malformed file — no frontmatter**: Mock `extractFrontmatter` returning `{ frontmatter: null, body: '' }`. Expect: 1 `fail` result ("No valid frontmatter"), no crash
- [ ] **Skills parsing**: Provide body with `## Skills\n\n- **\`create-prd\`**: desc\n- **\`run-tests\`**: desc`. Expect: `referencedSkills` = `['create-prd', 'run-tests']`
- [ ] **No agents directory**: Mock `listFiles` returning `[]`. Expect: empty results array, `context.agents` is an empty Map, no crash
- [ ] **Multiple agents**: Provide 2 valid agent files. Expect: 2 `pass` results, `context.agents` has 2 entries

## Acceptance Criteria

- [ ] `lib/checks/agents.js` exports an async function `checkAgents(basePath, context)` that returns `CheckResult[]`
- [ ] All `.agent.md` files in `.github/agents/` are discovered via `listFiles(agentsDir, '.agent.md')`
- [ ] Missing or empty `name` field produces a `fail` result with `category: 'agents'`
- [ ] Missing or empty `description` field produces a `fail` result
- [ ] Missing or empty `tools` array produces a `fail` result
- [ ] Missing `agents` field produces a `fail` result
- [ ] Each invalid tool name (not in `VALID_TOOLSETS` or `VALID_NAMESPACED_TOOLS`) produces a `fail` result with detail listing valid values
- [ ] Each deprecated tool name (in `DEPRECATED_TOOLS`) produces a `warn` result
- [ ] Valid toolset names and valid namespaced tools produce no fail/warn
- [ ] Non-empty `agents[]` without `agent` in `tools[]` produces a `fail` result
- [ ] Non-Orchestrator agent with non-empty `agents[]` produces a `fail` result
- [ ] `context.agents` is populated as a `Map<string, AgentInfo>` with one entry per discovered agent file
- [ ] Each `AgentInfo` has correct `filename`, `tools`, `agents`, and `referencedSkills` fields
- [ ] `referencedSkills` is correctly extracted from `## Skills` section of agent body
- [ ] Unreadable files produce `fail` results (no unhandled exceptions)
- [ ] Files with unparseable frontmatter produce `fail` results (no unhandled exceptions)
- [ ] Empty or missing agents directory produces empty results (no crash)
- [ ] All test cases in `tests/agents.test.js` pass
- [ ] `node -e "require('./lib/checks/agents')"` exits cleanly (no require errors)

## Constraints

- Do NOT import or `require()` any external npm packages — only Node.js built-ins and the project's own `lib/utils/*` modules
- Do NOT modify any existing files — only CREATE the two new files
- Do NOT validate that Orchestrator's `agents[]` entries match real agent names — that is the cross-references module's job (T5). This module only checks structural rules (agent toolset presence, Orchestrator-only rule)
- Do NOT parse `orchestration.yml` or any files outside `.github/agents/` — other modules handle those
- Do NOT write to `state.json` or `STATUS.md`
- Use `category: 'agents'` for ALL `CheckResult` objects returned by this module
- Use `path.join()` for ALL file path construction — no hardcoded `/` or `\\` separators
