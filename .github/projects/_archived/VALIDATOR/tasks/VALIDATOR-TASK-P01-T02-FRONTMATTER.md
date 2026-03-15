---
project: "VALIDATOR"
phase: 1
task: 2
title: "Frontmatter Extractor"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Frontmatter Extractor

## Objective

Create `lib/utils/frontmatter.js` — a CommonJS utility module that extracts and parses YAML frontmatter from markdown files. It must handle two distinct formats: standard `---` delimited blocks and fenced code block formats (` ```chatagent `, ` ```instructions `, ` ```skill `). The function never throws.

## Context

The orchestration system uses markdown files with YAML frontmatter in two different formats. Project planning documents (PRDs, architecture docs, phase plans, task handoffs) use standard `---` delimited frontmatter at the start of the file. Agent files (`.agent.md`), instruction files (`.instructions.md`), and skill files (`SKILL.md`) use fenced code block frontmatter where the `---` delimiters are nested inside a language-tagged code fence. The module must detect and parse both formats, returning a structured result with the parsed key-value pairs and the remaining body text.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `lib/utils/frontmatter.js` | Frontmatter extraction utility module |

## Frontmatter Format Examples

Below are **actual examples** from the workspace showing the two frontmatter formats this module must handle.

### Format 1: Standard `---` Delimited Frontmatter

Used by project planning documents. The file starts with `---` on line 1, followed by key-value pairs, closed by `---`:

```markdown
---
project: "VALIDATOR"
phase: 1
task: 2
title: "Frontmatter Extractor"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Frontmatter Extractor

Body content starts here...
```

Parsed result:
```javascript
{
  frontmatter: {
    project: "VALIDATOR",
    phase: 1,
    task: 2,
    title: "Frontmatter Extractor",
    status: "pending",
    skills_required: [],
    skills_optional: [],
    estimated_files: 1
  },
  body: "\n# Frontmatter Extractor\n\nBody content starts here...\n"
}
```

### Format 2: Fenced Code Block Frontmatter

Used by agent, instruction, and skill files. The file opens with a code fence (` ```chatagent `, ` ```instructions `, or ` ```skill `), then `---` delimiters inside the fence contain the frontmatter, and the fence is closed with ` ``` `. Body content follows after the closing fence.

**Example A — Agent file (` ```chatagent `):**

```
` ``chatagent
---
name: Orchestrator
description: "The main orchestration agent that coordinates the entire project pipeline."
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

You are the central coordinator...
` ``
```

*(Note: The outer backtick fences above are escaped for display. In the real file, the opening is ` ```chatagent ` and the closing is ` ``` ` with no space.)*

Parsed result:
```javascript
{
  frontmatter: {
    name: "Orchestrator",
    description: "The main orchestration agent that coordinates the entire project pipeline.",
    "argument-hint": "Describe the project to start, or ask to continue an existing project.",
    tools: ["read", "search", "agent"],
    agents: ["Research", "Product Manager", "UX Designer", "Architect", "Tactical Planner", "Coder", "Reviewer"]
  },
  body: "\n# Orchestrator\n\nYou are the central coordinator...\n"
}
```

**Example B — Instructions file (` ```instructions `):**

```
` ``instructions
---
applyTo: '.github/projects/**'
---

# Orchestration Project Document Conventions

When creating or editing project documents...
` ``
```

Parsed result:
```javascript
{
  frontmatter: {
    applyTo: ".github/projects/**"
  },
  body: "\n# Orchestration Project Document Conventions\n\nWhen creating or editing project documents...\n"
}
```

**Example C — Skill file (` ```skill `):**

```
` ``skill
---
name: create-prd
description: 'Create a Product Requirements Document (PRD) from research findings.'
---

# Create PRD

Generate a Product Requirements Document from research findings...
` ``
```

Parsed result:
```javascript
{
  frontmatter: {
    name: "create-prd",
    description: "Create a Product Requirements Document (PRD) from research findings."
  },
  body: "\n# Create PRD\n\nGenerate a Product Requirements Document from research findings...\n"
}
```

## Implementation Steps

1. **Create the file** at `lib/utils/frontmatter.js` with a single exported function `extractFrontmatter(fileContent)`.

2. **Detect fenced code block frontmatter first**. Check if the file starts with a line matching the pattern `` /^```(chatagent|instructions|skill)\s*$/ `` (case-insensitive). If it matches:
   - Find the closing ` ``` ` fence line (a line that is exactly ` ``` ` or ` ``` ` followed by whitespace).
   - Within the fenced block content, look for `---` delimiters. The frontmatter is between the first `---` and the second `---`.
   - The body is everything inside the fenced block after the closing `---`, PLUS everything after the closing ` ``` ` fence. (Note: In fenced format, the body text is typically inside the fence after the closing `---`. The content after the closing fence is usually empty or not present.)
   - Actually, looking at the real files more carefully: the body content (markdown headings, prose) is INSIDE the fenced block after the closing `---`. There is nothing after the closing ` ``` ` fence because the fence wraps the entire file. So: extract everything between the closing `---` and the closing ` ``` ` as the body.

3. **If no fenced block detected, check for standard `---` frontmatter**. Check if the first non-empty line is exactly `---`. If so:
   - Find the next `---` line (the closing delimiter).
   - Content between the two `---` lines is the frontmatter YAML.
   - Everything after the closing `---` is the body.

4. **If neither format is detected**, return `{ frontmatter: null, body: fileContent }`.

5. **Parse the extracted frontmatter YAML** using a simple line-by-line key-value parser:
   - Split the frontmatter block into lines.
   - For each line, check for `key: value` pattern.
   - Handle scalar values: unquoted strings, numbers (integers), booleans (`true`/`false`).
   - Handle quoted strings: strip matching single or double quotes from values.
   - Handle inline arrays: `[]` → empty array.
   - Handle YAML list values: when a key is followed by lines starting with `  - `, collect them into an array.
   - Handle quoted list items: strip quotes from `- 'item'` and `- "item"`.

6. **Wrap all logic in try/catch**. On any parse error, return `{ frontmatter: null, body: fileContent }`.

7. **Export** the function via `module.exports = { extractFrontmatter };`.

## Contracts & Interfaces

```typescript
// lib/utils/frontmatter.js

/**
 * Extract and parse YAML frontmatter from a markdown file's content.
 * Handles two formats:
 *   1. Standard: content between opening --- and closing --- at file start
 *   2. Fenced: content inside a ```chatagent or ```instructions or ```skill
 *      code block with --- delimiters inside
 *
 * @param fileContent - Full text content of the markdown file
 * @returns Object with { frontmatter: Record<string, any> | null, body: string }
 *          frontmatter is null if no valid frontmatter block is found
 */
function extractFrontmatter(fileContent: string): {
  frontmatter: Record<string, any> | null;
  body: string;
};

module.exports = { extractFrontmatter };
```

### Value Type Parsing Rules

| YAML Syntax | JavaScript Result |
|-------------|-------------------|
| `key: value` | `{ key: "value" }` |
| `key: "quoted value"` | `{ key: "quoted value" }` |
| `key: 'single quoted'` | `{ key: "single quoted" }` |
| `key: 42` | `{ key: 42 }` |
| `key: true` | `{ key: true }` |
| `key: false` | `{ key: false }` |
| `key: []` | `{ key: [] }` |
| `key:` followed by `  - item1` / `  - item2` | `{ key: ["item1", "item2"] }` |
| `key:` followed by `  - "quoted item"` | `{ key: ["quoted item"] }` |

## Styles & Design Tokens

Not applicable — this is a utility module with no UI output.

## Test Requirements

- [ ] Standard `---` frontmatter: extracts `key: value` pairs and returns correct body
- [ ] Standard frontmatter with quoted strings: single and double quotes are stripped
- [ ] Standard frontmatter with integer values: parsed as JavaScript numbers
- [ ] Standard frontmatter with boolean values: `true`/`false` parsed as JavaScript booleans
- [ ] Standard frontmatter with YAML lists: `- item` lines parsed into arrays
- [ ] Standard frontmatter with empty array `[]`: parsed as empty JavaScript array
- [ ] Fenced ` ```chatagent ` frontmatter: extracts frontmatter and body correctly
- [ ] Fenced ` ```instructions ` frontmatter: extracts frontmatter and body correctly
- [ ] Fenced ` ```skill ` frontmatter: extracts frontmatter and body correctly
- [ ] Fenced frontmatter with list values (e.g., `tools:` with `- read` items): parsed as arrays
- [ ] No frontmatter: file without `---` or fences returns `{ frontmatter: null, body: fullContent }`
- [ ] Empty string input: returns `{ frontmatter: null, body: "" }`
- [ ] Malformed frontmatter (unclosed `---`): returns `{ frontmatter: null, body: fullContent }`
- [ ] Never throws on any input

## Acceptance Criteria

- [ ] File exists at `lib/utils/frontmatter.js`
- [ ] Exports `extractFrontmatter` function via `module.exports = { extractFrontmatter }`
- [ ] Correctly extracts standard `---` delimited frontmatter (key-value pairs between `---` lines at file start)
- [ ] Correctly extracts fenced code block frontmatter (` ```chatagent `, ` ```instructions `, ` ```skill ` with `---` delimiters inside)
- [ ] Returns `{ frontmatter: null, body: fullContent }` when no frontmatter is found
- [ ] Parses scalar values (strings, integers, booleans)
- [ ] Parses quoted string values (single and double quotes stripped)
- [ ] Parses YAML list values (`- item` syntax) into JavaScript arrays
- [ ] Parses inline empty arrays (`[]`) into empty JavaScript arrays
- [ ] Never throws — returns `{ frontmatter: null, body: fileContent }` on any parse failure
- [ ] CommonJS module format (`require`/`module.exports`)
- [ ] Zero external dependencies — uses only built-in JavaScript string methods
- [ ] All tests pass
- [ ] No lint errors

## Constraints

- Do NOT import or require any external npm packages
- Do NOT import `fs`, `path`, or any Node.js built-in modules — this module operates on strings only
- Do NOT attempt to handle the full YAML spec — only the subset described above (scalars, quoted strings, simple lists, inline empty arrays, booleans, integers)
- Do NOT handle nested objects — frontmatter in this system is always flat key-value pairs (values are scalars or flat lists)
- Do NOT reference or read any external documentation files — everything needed is in this handoff
- Do NOT modify any existing files — only create the one new file
