---
project: "VALIDATOR"
status: "draft"
author: "architect-agent"
created: "2026-03-07T16:00:00Z"
---

# VALIDATOR — Architecture

## Technical Overview

VALIDATOR is a single-process, zero-dependency Node.js CLI tool that validates the `.github/` orchestration file ecosystem. It uses a modular check-runner architecture: an entry point parses CLI arguments, discovers files, delegates to category-specific check modules, collects structured results, and pipes them through a reporter that renders ANSI-colored (or plain-text) terminal output. All code is CommonJS JavaScript targeting Node.js 18+, using only the built-in `fs`, `path`, and `process` modules. The design prioritizes graceful degradation — malformed files, missing directories, and parse errors are reported as check failures rather than tool crashes.

## System Layers

```
┌─────────────────────────────────────────────────┐
│  CLI / Presentation                             │  Argument parsing, output formatting,
│  (validate-orchestration.js, lib/reporter.js)   │  ANSI colors, exit codes
├─────────────────────────────────────────────────┤
│  Application / Orchestration                    │  Check runner loop, category dispatch,
│  (validate-orchestration.js core logic)         │  result aggregation, filtering
├─────────────────────────────────────────────────┤
│  Domain / Checks                                │  Per-category validation logic:
│  (lib/checks/*.js)                              │  agents, skills, config, instructions,
│                                                 │  prompts, cross-refs
├─────────────────────────────────────────────────┤
│  Infrastructure / Utilities                     │  File I/O, YAML parsing, frontmatter
│  (lib/utils/*.js)                               │  extraction, glob-like file discovery
└─────────────────────────────────────────────────┘
```

## Module Map

| Module | Layer | Path | Responsibility |
|--------|-------|------|---------------|
| `validate-orchestration.js` | CLI + Application | `validate-orchestration.js` | Entry point. Parses CLI args, resolves base path, dispatches to check modules in category order, collects results, invokes reporter, sets exit code |
| `lib/reporter.js` | Presentation | `lib/reporter.js` | Renders `CheckResult[]` to stdout. Owns all ANSI token maps, marker maps, separator maps. Supports color/no-color/verbose/quiet modes |
| `lib/checks/structure.js` | Domain | `lib/checks/structure.js` | Validates `.github/` directory structure — required folders and files exist |
| `lib/checks/agents.js` | Domain | `lib/checks/agents.js` | Validates agent `.agent.md` files — frontmatter fields, tools array, agents array, deprecated tool detection, Orchestrator-specific rules |
| `lib/checks/skills.js` | Domain | `lib/checks/skills.js` | Validates skill directories — SKILL.md presence, frontmatter fields, name-folder match, templates/ subdirectory, description length |
| `lib/checks/config.js` | Domain | `lib/checks/config.js` | Validates `orchestration.yml` — field presence, enum values, type constraints, severity overlap, human gate enforcement |
| `lib/checks/instructions.js` | Domain | `lib/checks/instructions.js` | Validates `.instructions.md` files — frontmatter presence, `applyTo` field |
| `lib/checks/prompts.js` | Domain | `lib/checks/prompts.js` | Validates `.prompt.md` files — `description` field, `tools` array validity |
| `lib/checks/cross-refs.js` | Domain | `lib/checks/cross-refs.js` | Validates cross-references — agent→skill links, skill→template links, Orchestrator agents[] → real agent names, config paths |
| `lib/utils/yaml-parser.js` | Infrastructure | `lib/utils/yaml-parser.js` | Lightweight YAML parser for `orchestration.yml`. Handles scalars, lists, nested objects, quoted strings. No anchors/aliases/multi-doc support |
| `lib/utils/frontmatter.js` | Infrastructure | `lib/utils/frontmatter.js` | Extracts YAML frontmatter from markdown files (both `---` delimited and fenced code block styles). Returns parsed key-value pairs |
| `lib/utils/fs-helpers.js` | Infrastructure | `lib/utils/fs-helpers.js` | File system helpers — `existsSync` wrappers, directory listing with glob-like filtering, safe file reading with error capture |

## Contracts & Interfaces

All interfaces are documented in TypeScript syntax for precision. Implementation is plain JavaScript — these interfaces serve as the binding contract between modules.

### Core Data Types

```typescript
// lib/types.d.ts (documentation only — not a shipped file)

/**
 * The result of a single validation check.
 * Every check function returns an array of these.
 */
interface CheckResult {
  /** Category grouping: 'structure' | 'agents' | 'skills' | 'config' | 'instructions' | 'prompts' | 'cross-references' */
  category: string;
  /** Human-readable identifier — typically a filename or config path (e.g., 'research.agent.md', 'orchestration.yml — git.strategy') */
  name: string;
  /** Outcome of this check */
  status: 'pass' | 'fail' | 'warn';
  /** One-line description of what was checked or what went wrong */
  message: string;
  /** Optional structured detail for verbose/failure output */
  detail?: CheckDetail;
}

/**
 * Structured context attached to a CheckResult.
 * Always shown for failures; shown for pass/warn only in --verbose mode.
 */
interface CheckDetail {
  /** What the validator expected */
  expected: string;
  /** What was actually found */
  found: string;
  /** Optional additional context (e.g., list of valid values) */
  context?: string;
}
```

### Check Module Contract

Every check module in `lib/checks/` must export a single async function conforming to this signature:

```typescript
/**
 * @param basePath - Absolute path to the workspace root (parent of .github/)
 * @param context  - Shared discovery context (populated by earlier checks)
 * @returns Array of CheckResult objects for this category
 */
type CheckFunction = (basePath: string, context: DiscoveryContext) => Promise<CheckResult[]>;
```

Each module's default export:

```typescript
// lib/checks/structure.js
module.exports = async function checkStructure(basePath: string, context: DiscoveryContext): Promise<CheckResult[]>;

// lib/checks/agents.js
module.exports = async function checkAgents(basePath: string, context: DiscoveryContext): Promise<CheckResult[]>;

// lib/checks/skills.js
module.exports = async function checkSkills(basePath: string, context: DiscoveryContext): Promise<CheckResult[]>;

// lib/checks/config.js
module.exports = async function checkConfig(basePath: string, context: DiscoveryContext): Promise<CheckResult[]>;

// lib/checks/instructions.js
module.exports = async function checkInstructions(basePath: string, context: DiscoveryContext): Promise<CheckResult[]>;

// lib/checks/prompts.js
module.exports = async function checkPrompts(basePath: string, context: DiscoveryContext): Promise<CheckResult[]>;

// lib/checks/cross-refs.js
module.exports = async function checkCrossRefs(basePath: string, context: DiscoveryContext): Promise<CheckResult[]>;
```

### Discovery Context

A mutable context object passed through the check pipeline. Earlier checks populate it; later checks (especially `cross-refs`) read from it.

```typescript
/**
 * Shared context populated by check modules as they run.
 * Avoids redundant file reads and enables cross-reference validation.
 */
interface DiscoveryContext {
  /** Map of agent filename → parsed agent metadata. Populated by checkAgents. */
  agents: Map<string, AgentInfo>;
  /** Map of skill folder name → parsed skill metadata. Populated by checkSkills. */
  skills: Map<string, SkillInfo>;
  /** Parsed orchestration.yml content. Populated by checkConfig. */
  config: Record<string, any> | null;
  /** List of discovered instruction files with metadata. Populated by checkInstructions. */
  instructions: InstructionInfo[];
  /** List of discovered prompt files with metadata. Populated by checkPrompts. */
  prompts: PromptInfo[];
}

interface AgentInfo {
  /** Filename (e.g., 'orchestrator.agent.md') */
  filename: string;
  /** Parsed frontmatter fields */
  frontmatter: Record<string, any>;
  /** Extracted tools array */
  tools: string[];
  /** Extracted agents array */
  agents: string[];
  /** Skill names referenced in agent body's ## Skills section */
  referencedSkills: string[];
}

interface SkillInfo {
  /** Folder name (e.g., 'create-prd') */
  folderName: string;
  /** Parsed SKILL.md frontmatter */
  frontmatter: Record<string, any>;
  /** Whether templates/ subdirectory exists */
  hasTemplates: boolean;
  /** Template link targets found in SKILL.md body (e.g., ['./templates/PRD.md']) */
  templateLinks: string[];
}

interface InstructionInfo {
  /** Filename (e.g., 'project-docs.instructions.md') */
  filename: string;
  /** Parsed frontmatter */
  frontmatter: Record<string, any>;
}

interface PromptInfo {
  /** Filename (e.g., 'configure-system.prompt.md') */
  filename: string;
  /** Parsed frontmatter */
  frontmatter: Record<string, any>;
}
```

### Reporter Contract

```typescript
// lib/reporter.js

interface ReporterOptions {
  /** Suppress ANSI color codes */
  noColor: boolean;
  /** Show detail blocks for all checks, not just failures */
  verbose: boolean;
  /** Show only the final summary bar */
  quiet: boolean;
}

/**
 * Render validation results to stdout.
 * @param results - All CheckResult objects, in category order
 * @param options - Display mode flags
 */
function report(results: CheckResult[], options: ReporterOptions): void;

/**
 * Print the --help usage text to stdout.
 */
function printHelp(): void;

module.exports = { report, printHelp };
```

### Utility Contracts

```typescript
// lib/utils/yaml-parser.js

/**
 * Parse a YAML string into a nested plain object.
 * Supports: scalars, single/double-quoted strings, arrays (- item),
 * nested objects (indented keys), inline booleans, integers.
 * Does NOT support: anchors, aliases, multi-document, flow style, multiline scalars.
 * 
 * @param yamlString - Raw YAML content
 * @returns Parsed object, or null if parsing fails entirely
 */
function parseYaml(yamlString: string): Record<string, any> | null;

module.exports = { parseYaml };
```

```typescript
// lib/utils/frontmatter.js

/**
 * Extract and parse YAML frontmatter from a markdown file's content.
 * Handles two formats:
 *   1. Standard: content between opening --- and closing --- at file start
 *   2. Fenced: content inside a ```chatagent or ```instructions code block with --- delimiters
 * 
 * @param fileContent - Full text content of the markdown file
 * @returns Object with { frontmatter: Record<string, any> | null, body: string }
 *          frontmatter is null if no valid frontmatter block is found
 */
function extractFrontmatter(fileContent: string): { frontmatter: Record<string, any> | null; body: string };

module.exports = { extractFrontmatter };
```

```typescript
// lib/utils/fs-helpers.js

/**
 * Check if a path exists (file or directory).
 * @returns true if path exists, false otherwise. Never throws.
 */
function exists(filePath: string): boolean;

/**
 * Check if a path is a directory.
 * @returns true if path exists and is a directory, false otherwise. Never throws.
 */
function isDirectory(dirPath: string): boolean;

/**
 * List files in a directory matching a suffix pattern.
 * @param dirPath - Absolute path to directory
 * @param suffix - File suffix to match (e.g., '.agent.md'). Empty string = all files.
 * @returns Array of filenames (not full paths). Empty array if directory doesn't exist.
 */
function listFiles(dirPath: string, suffix?: string): string[];

/**
 * List subdirectories in a directory.
 * @param dirPath - Absolute path to directory
 * @returns Array of directory names (not full paths). Empty array if parent doesn't exist.
 */
function listDirs(dirPath: string): string[];

/**
 * Read a file's content as UTF-8 string.
 * @returns File content, or null if the file doesn't exist or can't be read. Never throws.
 */
function readFile(filePath: string): string | null;

module.exports = { exists, isDirectory, listFiles, listDirs, readFile };
```

### CLI Options Contract

```typescript
// Internal to validate-orchestration.js

interface CLIOptions {
  help: boolean;
  noColor: boolean;
  verbose: boolean;
  quiet: boolean;
  category: string | null;  // null = run all categories
}
```

### Constants

```typescript
// Internal to lib/checks/agents.js (or a shared constants section at top of module)

/** Valid toolset names for agent tools arrays */
const VALID_TOOLSETS: string[] = ['read', 'search', 'edit', 'execute', 'web', 'todo', 'agent', 'vscode'];

/** Known valid namespaced tool identifiers */
const VALID_NAMESPACED_TOOLS: string[] = [
  'web/fetch',
  'read/readFile', 'read/readDirectory', 'read/listDirectory',
  'edit/editFiles', 'edit/createFile', 'edit/deleteFile', 'edit/moveFile',
  'execute/runInTerminal'
];

/** Deprecated tool names that should not appear in tools arrays */
const DEPRECATED_TOOLS: string[] = [
  'readFile', 'editFile', 'createFile', 'deleteFile', 'moveFile',
  'findFiles', 'listDirectory', 'runInTerminal', 'fetchWebpage',
  'searchCodebase', 'searchFiles', 'runTests'
];

/** Valid category names for --category filter */
const CATEGORIES: string[] = [
  'structure', 'agents', 'skills', 'config',
  'instructions', 'prompts', 'cross-references'
];

/** Check category → check module mapping */
const CHECK_MODULES: Record<string, string> = {
  'structure':        './lib/checks/structure',
  'agents':           './lib/checks/agents',
  'skills':           './lib/checks/skills',
  'config':           './lib/checks/config',
  'instructions':     './lib/checks/instructions',
  'prompts':          './lib/checks/prompts',
  'cross-references': './lib/checks/cross-refs'
};
```

## API Endpoints

Not applicable. VALIDATOR is a CLI tool with no network interface.

## Dependencies

### External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| _(none)_ | — | Zero external dependencies per NFR-2 |

### Internal Dependencies (module → module)

```
validate-orchestration.js
  ├── lib/reporter.js
  ├── lib/checks/structure.js ──→ lib/utils/fs-helpers.js
  ├── lib/checks/agents.js ────→ lib/utils/fs-helpers.js
  │                             → lib/utils/frontmatter.js
  ├── lib/checks/skills.js ────→ lib/utils/fs-helpers.js
  │                             → lib/utils/frontmatter.js
  ├── lib/checks/config.js ────→ lib/utils/fs-helpers.js
  │                             → lib/utils/yaml-parser.js
  ├── lib/checks/instructions.js → lib/utils/fs-helpers.js
  │                               → lib/utils/frontmatter.js
  ├── lib/checks/prompts.js ───→ lib/utils/fs-helpers.js
  │                             → lib/utils/frontmatter.js
  └── lib/checks/cross-refs.js → lib/utils/fs-helpers.js
```

### Node.js Built-in Modules Used

| Module | Used By | Purpose |
|--------|---------|---------|
| `fs` | `lib/utils/fs-helpers.js` | `readFileSync`, `readdirSync`, `existsSync`, `statSync` |
| `path` | All modules | `path.join()`, `path.resolve()`, `path.basename()`, `path.sep` |
| `process` | `validate-orchestration.js`, `lib/reporter.js` | `process.argv`, `process.exit()`, `process.cwd()`, `process.stdout.isTTY`, `process.env.NO_COLOR` |

## File Structure

```
validate-orchestration.js          # Entry point — CLI arg parsing, check orchestration, exit code
lib/
├── reporter.js                    # Output formatting — ANSI tokens, markers, separators, verbosity
├── checks/
│   ├── structure.js               # Category: File Structure — required dirs/files in .github/
│   ├── agents.js                  # Category: Agents — frontmatter, tools, agents array, deprecated tools
│   ├── skills.js                  # Category: Skills — dir structure, SKILL.md, frontmatter, templates/
│   ├── config.js                  # Category: Configuration — orchestration.yml fields + values
│   ├── instructions.js            # Category: Instructions — frontmatter, applyTo field
│   ├── prompts.js                 # Category: Prompts — frontmatter, description, tools array
│   └── cross-refs.js              # Category: Cross-References — agent→skill, skill→template, config→path
└── utils/
    ├── yaml-parser.js             # YAML parser — scalars, lists, nested objects (no external deps)
    ├── frontmatter.js             # Frontmatter extractor — --- delimited and fenced code block styles
    └── fs-helpers.js              # File system helpers — exists, isDirectory, listFiles, listDirs, readFile
```

**Total**: 12 source files (1 entry point + 1 reporter + 7 check modules + 3 utility modules).

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| **Error handling** | Every check module wraps its logic in try/catch. If a file is missing, unreadable, or has unparseable content, the module emits a `fail` or `warn` CheckResult and continues — it never throws an unhandled exception. Utility functions (`readFile`, `extractFrontmatter`, `parseYaml`) return `null` on failure rather than throwing. The entry point has a top-level catch that prints a stack trace and exits with code 1 for truly unexpected errors. |
| **Path handling** | All file paths are constructed using `path.join()` from the resolved `basePath`. No hardcoded `/` or `\\` separators anywhere in application code. The entry point resolves `basePath` via `path.resolve(process.cwd())`. This ensures correct behavior on Windows, macOS, and Linux (NFR-3, NFR-4). |
| **YAML parsing** | Two distinct YAML parsing strategies: (1) `frontmatter.js` handles the simple key-value / key-list subset found in markdown frontmatter blocks — it uses regex line-by-line parsing. (2) `yaml-parser.js` handles the richer nested structure of `orchestration.yml` — it uses indentation-aware line-by-line parsing to build a nested object. Neither supports YAML anchors, aliases, flow collections, or multi-document streams — these are not used anywhere in the orchestration system. If parsing fails, the parser returns `null` and the calling check module emits a `fail` result. |
| **Color/no-color** | The reporter owns all ANSI escape sequences. It exposes a token map initialized at startup: if `--no-color` is passed, `process.env.NO_COLOR` is set, or `process.stdout.isTTY` is falsy, every token resolves to an empty string and markers switch from Unicode (`✓`/`✗`/`⚠`) to ASCII (`[PASS]`/`[FAIL]`/`[WARN]`). No other module touches stdout directly or embeds ANSI codes. |
| **Verbosity** | The reporter receives the full `CheckResult[]` array and the `ReporterOptions`. In `quiet` mode it renders only the final summary bar. In default mode it renders all check lines but only shows `CheckDetail` for failures. In `verbose` mode it shows `CheckDetail` for every check. The check modules are unaware of verbosity — they always populate `detail` when context is available. |
| **Discovery context sharing** | The `DiscoveryContext` object is created once by the entry point and passed by reference to each check module in order. Each module populates its section (e.g., `checkAgents` fills `context.agents`). The `cross-refs` module, which runs last, reads from all populated sections. This avoids redundant file reads and decouples cross-reference logic from individual file parsers. |
| **Category filtering** | The `--category <name>` flag causes only the named check module to run. However, cross-references depend on data from earlier checks. If `--category cross-references` is selected alone, the entry point runs all prerequisite checks silently (populating context) but only reports results from the cross-references category. This ensures correctness without requiring the user to understand dependency order. |
| **Exit codes** | The entry point counts failures after all checks complete. Exit code is `0` if failures === 0 (warnings are acceptable). Exit code is `1` if failures > 0. The `--help` flag prints help and exits with code `0` immediately. |
| **Encoding** | All files are read as UTF-8 (`fs.readFileSync(path, 'utf-8')`). This matches the encoding of all orchestration markdown and YAML files. |

## Data Flow

```
CLI Invocation
     │
     ▼
┌─────────────────────┐
│  Parse CLI args      │  process.argv → CLIOptions
│  (--help exits)      │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Resolve basePath    │  process.cwd() → path.resolve()
│  Create context {}   │
└────────┬────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Run checks in category order:          │
│                                         │
│  1. structure(basePath, ctx)  → results │
│  2. agents(basePath, ctx)     → results │  ← populates ctx.agents
│  3. skills(basePath, ctx)     → results │  ← populates ctx.skills
│  4. config(basePath, ctx)     → results │  ← populates ctx.config
│  5. instructions(basePath, ctx)→ results│  ← populates ctx.instructions
│  6. prompts(basePath, ctx)    → results │  ← populates ctx.prompts
│  7. cross-refs(basePath, ctx) → results │  ← reads all ctx sections
│                                         │
│  All results pushed to allResults[]     │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Filter by category  │  If --category given, keep only matching category results
│  (if applicable)     │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  reporter.report()   │  Render to stdout per ReporterOptions
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Set exit code       │  0 if no failures, 1 if any failure
│  process.exit()      │
└─────────────────────┘
```

## Phasing Recommendations

The following phasing is advisory — the Tactical Planner makes final decisions.

### Phase 1: Core Infrastructure

**Goal**: Establish the foundation — entry point, utilities, reporter, and one simple check module to validate the end-to-end pipeline.

**Scope**:
- `lib/utils/fs-helpers.js` — All file system helper functions
- `lib/utils/frontmatter.js` — Frontmatter extraction (both `---` and fenced block formats)
- `lib/utils/yaml-parser.js` — YAML parser for `orchestration.yml`
- `lib/reporter.js` — Full reporter with ANSI tokens, no-color fallback, all verbosity modes, header, category blocks, summary bar
- `validate-orchestration.js` — CLI argument parsing, check orchestration loop, exit codes, `--help` output
- `lib/checks/structure.js` — File Structure category checks (simplest check module; proves the pipeline)
- `DiscoveryContext` creation and wiring

**Exit criteria**: Running `node validate-orchestration.js` produces a colored report with File Structure checks. `--no-color`, `--verbose`, `--quiet`, and `--help` flags all work. Exit code is correct.

### Phase 2: Validation Checks

**Goal**: Implement all remaining check modules — the core validation logic.

**Scope**:
- `lib/checks/agents.js` — All agent validation (FR-1 through FR-4)
- `lib/checks/skills.js` — All skill validation (FR-5 through FR-7)
- `lib/checks/config.js` — Full config validation including value constraints (FR-9 through FR-12)
- `lib/checks/instructions.js` — Instruction file validation (FR-8)
- `lib/checks/prompts.js` — Prompt file validation (FR-15)
- `lib/checks/cross-refs.js` — All cross-reference checks (FR-13, FR-14)
- Each module populates `DiscoveryContext` for downstream use

**Exit criteria**: A full validation run covers all 7 categories with checks for every FR at P0 and P1 priority. All checks produce correct pass/fail/warn results against the live `.github/` directory. Zero false positives on a valid workspace.

### Phase 3: Polish & Hardening

**Goal**: Edge cases, platform testing, anomaly detection, and CI readiness.

**Scope**:
- Anomaly detection (FR-22: `create-skill` bare file warning)
- `--category` filter with silent prerequisite loading
- Non-TTY auto-detection for automatic `--no-color`
- `NO_COLOR` environment variable support
- Cross-platform path testing (Windows backslash handling)
- Graceful degradation on malformed/empty files (NFR-8)
- Performance validation (< 2 second target per NFR-1)
- Final end-to-end validation against the live workspace

**Exit criteria**: The tool runs correctly on Windows, macOS, and Linux. Non-TTY output is clean. All edge cases (missing files, empty files, corrupt frontmatter) degrade gracefully. Performance meets the 2-second target. The tool is CI-ready with correct exit codes and `--no-color` support.
