---
project: "RAINBOW-HELLO"
phase: 1
title: "Core ASCII Art + Rainbow Colors"
status: "active"
total_tasks: 4
tasks:
  - id: "T01-SCAFFOLD"
    title: "Project Scaffold + Font Module"
  - id: "T02-RENDERER"
    title: "Renderer Module"
  - id: "T03-COLORIZER"
    title: "Colors + Colorizer Module"
  - id: "T04-ENTRYPOINT"
    title: "Entrypoint + README"
author: "tactical-planner-agent"
created: "2026-03-15"
---

# Phase 1: Core ASCII Art + Rainbow Colors

## Phase Goal

Deliver the static "HELLO WORLD" rainbow ASCII art CLI — run `node index.js` or `npm start`, display rainbow-colored 5-line-tall ASCII block art, and exit. All core domain modules, the entrypoint, and unit tests are included.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../RAINBOW-HELLO-MASTER-PLAN.md) | Phase 1 scope, exit criteria, execution constraints (max 8 tasks/phase) |
| [Architecture](../RAINBOW-HELLO-ARCHITECTURE.md) | Module map, contracts/interfaces for font.js, renderer.js, colors.js, colorizer.js, index.js; file structure; dependency graph; package.json structure |
| [Design](../RAINBOW-HELLO-DESIGN.md) | ASCII art letter specifications (glyph designs, widths), rainbow color palette hex values, layout tokens (letter-spacing, word-spacing, margins) |
| [PRD](../RAINBOW-HELLO-PRD.md) | Functional requirements FR-1 through FR-10, non-functional requirements NFR-1 through NFR-9, success metrics |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01-SCAFFOLD | Project Scaffold + Font Module | — | Node.js, ESM | 3 | `tasks/RAINBOW-HELLO-TASK-P01-T01-SCAFFOLD.md` |
| T02-RENDERER | Renderer Module | T01-SCAFFOLD | Node.js, ESM | 2 | `tasks/RAINBOW-HELLO-TASK-P01-T02-RENDERER.md` |
| T03-COLORIZER | Colors + Colorizer Module | T01-SCAFFOLD | Node.js, ESM, chalk | 3 | `tasks/RAINBOW-HELLO-TASK-P01-T03-COLORIZER.md` |
| T04-ENTRYPOINT | Entrypoint + README | T02-RENDERER, T03-COLORIZER | Node.js, ESM | 2 | `tasks/RAINBOW-HELLO-TASK-P01-T04-ENTRYPOINT.md` |

## Task Details

### T01-SCAFFOLD — Project Scaffold + Font Module

**Objective**: Create the project foundation and the first leaf domain module with tests.

**Files**:
- `sample-apps/rainbow-hello/package.json` — CREATE — Project metadata, `"type": "module"`, chalk `^5.4.0` dependency, `start` and `test` scripts, `engines.node >= 18.0.0`
- `sample-apps/rainbow-hello/lib/font.js` — CREATE — Export `GLYPHS` (Record of 8 characters → 5-row string arrays) and `GLYPH_HEIGHT` constant. Characters: H, E, L, O, W, R, D, space. Each glyph is exactly 5 rows tall with consistent width per letter. Letter width is 5 columns; space width is 4 columns. Uses only the letter's own character and spaces.
- `sample-apps/rainbow-hello/test/font.test.js` — CREATE — Validate glyph structure: every glyph has exactly 5 rows, all rows within a glyph have equal length, only supported characters are present, `GLYPH_HEIGHT` equals 5.

**Key Contracts**:
- `GLYPHS`: `Record<string, string[]>` — keys are `'H'`, `'E'`, `'L'`, `'O'`, `'W'`, `'R'`, `'D'`, `' '`
- `GLYPH_HEIGHT`: `number` — constant `5`
- Each glyph value is an array of exactly 5 strings with equal length per glyph

**Acceptance Criteria**:
- `package.json` has `"type": "module"`, chalk `^5.4.0` in dependencies, valid `start` and `test` scripts
- `font.js` exports `GLYPHS` with all 8 characters and `GLYPH_HEIGHT`
- `node --test test/font.test.js` passes all assertions

---

### T02-RENDERER — Renderer Module

**Objective**: Build the art composition module that assembles individual letter glyphs into the full multi-line ASCII art string.

**Files**:
- `sample-apps/rainbow-hello/lib/renderer.js` — CREATE — Export `renderText(text, options)` that composes letter glyphs into a 5-row art string array with inter-letter spacing (default 2) and inter-word spacing (default 4). Throws on unsupported characters.
- `sample-apps/rainbow-hello/test/renderer.test.js` — CREATE — Validate: correct row count (5), correct spacing between letters and words, total width ≤ 76 columns for "HELLO WORLD", throws on unknown character.

**Key Contracts**:
- `renderText(text: string, options?: { letterSpacing?: number, wordSpacing?: number }): string[]`
- Returns array of exactly 5 strings
- Imports `GLYPHS` and `GLYPH_HEIGHT` from `font.js`

**Acceptance Criteria**:
- `renderText("HELLO WORLD")` returns 5 strings of equal length
- Inter-letter spacing is 2 columns, inter-word spacing is 4 columns
- Total width of `renderText("HELLO WORLD")` is ≤ 76 columns
- `renderText("XYZ")` throws an Error for unsupported characters
- `node --test test/renderer.test.js` passes all assertions

---

### T03-COLORIZER — Colors + Colorizer Module

**Objective**: Create the rainbow color palette constants and the colorization module that applies per-letter ANSI colors to composed art rows.

**Files**:
- `sample-apps/rainbow-hello/lib/colors.js` — CREATE — Export `RAINBOW_COLORS` (9-element hex array) and `LETTER_COLOR_MAP` (11-element array mapping each character of "HELLO WORLD" to a hex color or `null` for the space).
- `sample-apps/rainbow-hello/lib/colorizer.js` — CREATE — Export `colorize(rows, text, options)` that applies per-letter-column chalk RGB colors to art row strings. Space gap receives no color. Returns colored string array. In no-color mode, returns rows unchanged.
- `sample-apps/rainbow-hello/test/colorizer.test.js` — CREATE — Validate: output has 5 rows, colored output contains ANSI escape sequences, space gap columns have no ANSI codes, no-color mode returns rows unchanged.

**Key Contracts**:
- `RAINBOW_COLORS: string[]` — `['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#4B0082', '#8B00FF', '#FF00FF']`
- `LETTER_COLOR_MAP: (string|null)[]` — `['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#00FFFF', null, '#0000FF', '#4B0082', '#8B00FF', '#FF00FF', '#FF0000']`
- `colorize(rows: string[], text: string, options?: { letterSpacing?: number, wordSpacing?: number }): string[]`
- Returns array of 5 strings with ANSI color codes (or plain strings in no-color mode)

**Acceptance Criteria**:
- `RAINBOW_COLORS` has exactly 9 hex entries in the correct order
- `LETTER_COLOR_MAP` has exactly 11 entries with `null` at index 5
- `colorize()` returns 5 rows with ANSI codes when color is supported
- Space gap columns have no ANSI color codes applied
- `node --test test/colorizer.test.js` passes all assertions

---

### T04-ENTRYPOINT — Entrypoint + README

**Objective**: Wire all domain modules together in the CLI entrypoint and create the project README.

**Files**:
- `sample-apps/rainbow-hello/index.js` — CREATE — Composition root: imports `renderText` from renderer.js and `colorize` from colorizer.js. Calls `renderText("HELLO WORLD")`, pipes result through `colorize()`, prints 1 blank line (top margin), prints 5 colored art rows, prints 1 blank line (bottom margin). Process exits naturally.
- `sample-apps/rainbow-hello/README.md` — CREATE — Installation (`npm install`), usage (`node index.js` or `npm start`), test instructions (`npm test`), project description, Node.js 18+ requirement.

**Key Contracts**:
- `index.js` is the composition root — sole file that imports multiple domain modules
- Output format: blank line → 5 colored art rows → blank line (7 lines total)
- No try/catch wrapping — unhandled errors produce natural Node.js stack trace

**Acceptance Criteria**:
- `node index.js` displays "HELLO WORLD" in rainbow-colored 5-line ASCII art with top/bottom margins
- `npm start` works as an alias for `node index.js`
- Output degrades gracefully with `NO_COLOR=1` (plain monochrome art, no ANSI codes)
- Total output is 7 lines (1 + 5 + 1)
- README contains installation, usage, and test instructions

## Execution Order

```
T01-SCAFFOLD (Project Scaffold + Font Module)
 ├→ T02-RENDERER (Renderer — depends on T01)
 └→ T03-COLORIZER (Colors + Colorizer — depends on T01)  ← parallel-ready
T04-ENTRYPOINT (Entrypoint + README — depends on T02, T03)
```

**Sequential execution order**: T01-SCAFFOLD → T02-RENDERER → T03-COLORIZER → T04-ENTRYPOINT

*Note: T02-RENDERER and T03-COLORIZER are parallel-ready (no mutual dependency) but will execute sequentially in v1.*

## Phase Exit Criteria

- [ ] `node index.js` displays "HELLO WORLD" in rainbow-colored 5-line ASCII art
- [ ] `npm test` passes all tests (font, renderer, colorizer)
- [ ] Output degrades gracefully with `NO_COLOR=1` (plain monochrome art, no ANSI codes)
- [ ] Total output width ≤ 80 columns
- [ ] Only one external runtime dependency (chalk) in `package.json`
- [ ] `package.json` has `"type": "module"` and valid `start`/`test` scripts
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] Build passes (`npm install` succeeds)
- [ ] All tests pass (`npm test` exits 0)

## Known Risks for This Phase

- **Glyph alignment**: Hardcoded ASCII art may look misaligned if glyph widths are inconsistent — mitigated by font.test.js validating equal row lengths per glyph
- **Colorizer column mapping**: The colorizer must correctly map each letter's column span to its color; off-by-one errors in column math would produce miscolored output — mitigated by colorizer.test.js
- **chalk ESM import**: chalk v5 is ESM-only; importing it requires `"type": "module"` in package.json — mitigated by T01-SCAFFOLD establishing ESM config first
