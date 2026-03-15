---
project: "RAINBOW-HELLO"
phase: 1
task: 2
title: "Renderer Module"
status: "pending"
skills_required: ["Node.js", "ESM"]
skills_optional: []
estimated_files: 2
---

# Renderer Module

## Objective

Create the `renderer.js` module that composes individual letter glyphs into a full multi-line ASCII art string array with configurable inter-letter and inter-word spacing, and create comprehensive unit tests for it.

## Context

The project `sample-apps/rainbow-hello/` is an ESM Node.js 18+ CLI app. Task T01 created `lib/font.js`, which exports `GLYPHS` (a map of 8 characters to 5-row string arrays) and `GLYPH_HEIGHT` (constant `5`). The renderer module imports these exports and composes them into full-width art lines. Each letter glyph is 5 columns wide; the space glyph is 4 columns wide. All glyphs are exactly 5 rows tall. Testing uses `node:test` and `node:assert` only — no third-party test frameworks.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `sample-apps/rainbow-hello/lib/renderer.js` | Art composition module — exports `renderText()` |
| CREATE | `sample-apps/rainbow-hello/test/renderer.test.js` | Unit tests for renderer using `node:test` and `node:assert` |

## Implementation Steps

1. **Create `lib/renderer.js`** — add the ESM import for `GLYPHS` and `GLYPH_HEIGHT` from `./font.js`.

2. **Implement `renderText(text, options)`** — the function accepts an uppercase text string and an optional options object with `letterSpacing` (default `2`) and `wordSpacing` (default `4`). It returns an array of exactly 5 strings representing the composed art rows.

3. **Character validation** — before composing, iterate through each character in `text`. If any character is not a key in `GLYPHS`, throw an `Error` with a message that includes the unsupported character.

4. **Row composition logic** — for each row index `0..4`, build the row string by iterating through each character in `text`:
   - If the character is `' '` (space): append `wordSpacing` space characters (default 4 columns of spaces). Do NOT add `letterSpacing` before or after the word gap.
   - If the character is a letter and it is the first character of the text OR the previous character was a space: append the glyph row directly (no leading `letterSpacing`).
   - Otherwise (letter following another letter): append `letterSpacing` space characters (default 2), then append the glyph row.

5. **Ensure equal-length rows** — all 5 returned strings must have exactly the same length. The composition logic naturally produces equal-length rows since every glyph has consistent row lengths and the same spacing is applied per row.

6. **Export** — use a named ESM export: `export function renderText(text, options) { ... }`.

7. **Create `test/renderer.test.js`** — import `renderText` from `../lib/renderer.js`. Write tests using `node:test` (`describe`, `it`) and `node:assert` (`strictEqual`, `ok`, `throws`).

8. **Write the following test cases** (see Test Requirements section for details).

9. **Verify** — run `node --test test/renderer.test.js` and confirm all tests pass.

## Contracts & Interfaces

### renderer.js — Art Composition

```javascript
// sample-apps/rainbow-hello/lib/renderer.js

import { GLYPHS, GLYPH_HEIGHT } from "./font.js";

/**
 * Compose a text string into multi-line ASCII art using glyphs from font.js.
 *
 * @param {string} text — The text to render (e.g. "HELLO WORLD"). Only characters present in GLYPHS are supported.
 * @param {object} [options]
 * @param {number} [options.letterSpacing=2] — Number of space columns between adjacent letters within a word.
 * @param {number} [options.wordSpacing=4] — Number of space columns for the space character between words.
 * @returns {string[]} — Array of 5 strings, one per row. Each string is the full-width composed art line.
 * @throws {Error} If text contains a character not present in GLYPHS.
 */
export function renderText(text, options) { /* ... */ }
```

### font.js — Dependency Contract (already built, DO NOT modify)

```javascript
// sample-apps/rainbow-hello/lib/font.js

/**
 * @typedef {string[]} Glyph — Array of exactly 5 strings with equal length per glyph.
 */

/** @type {Record<string, Glyph>} */
export const GLYPHS;
// Keys: 'H', 'E', 'L', 'O', 'W', 'R', 'D', ' '
// Letter glyphs: 5 columns wide each
// Space glyph: 4 columns wide

/** @type {number} */
export const GLYPH_HEIGHT; // 5
```

Actual glyph dimensions for reference (from the built `font.js`):

| Character | Width (columns) |
|-----------|----------------|
| H | 5 |
| E | 5 |
| L | 5 |
| O | 5 |
| W | 5 |
| R | 5 |
| D | 5 |
| (space) | 4 |

## Styles & Design Tokens

- `$letter-height`: `5` rows — number of rows per glyph and per output line
- `$letter-spacing`: `2` columns — space characters between adjacent letters within a word (default for `options.letterSpacing`)
- `$word-spacing`: `4` columns — space characters for the space character between words (default for `options.wordSpacing`)

### Expected Width Calculation for "HELLO WORLD"

With default spacing (`letterSpacing=2`, `wordSpacing=4`):

```
"HELLO" = H(5) + 2 + E(5) + 2 + L(5) + 2 + L(5) + 2 + O(5) = 33 columns
" "     = 4 columns (wordSpacing)
"WORLD" = W(5) + 2 + O(5) + 2 + R(5) + 2 + L(5) + 2 + D(5) = 33 columns
Total   = 33 + 4 + 33 = 70 columns (≤ 76)
```

## Test Requirements

- [ ] `renderText("HELLO WORLD")` returns an array of exactly 5 strings
- [ ] All 5 returned strings have identical length (equal-width rows)
- [ ] `renderText("HELLO WORLD")` with default spacing produces rows of 70 columns
- [ ] Inter-letter spacing is correctly applied: for a simple two-letter input like `"HE"`, the row width is `5 + 2 + 5 = 12`
- [ ] Inter-word spacing is correctly applied: for `"H H"`, the row width is `5 + 4 + 5 = 14` (no letterSpacing around the space)
- [ ] Custom spacing options work: `renderText("HE", { letterSpacing: 3 })` produces rows of width `5 + 3 + 5 = 13`
- [ ] `renderText("X")` throws an `Error` for an unsupported character
- [ ] `renderText("HELLO X")` throws an `Error` for an unsupported character within a longer string
- [ ] Single character input works: `renderText("H")` returns 5 rows of width 5

## Acceptance Criteria

- [ ] `sample-apps/rainbow-hello/lib/renderer.js` exists and exports `renderText` as a named ESM export
- [ ] `renderText("HELLO WORLD")` returns exactly 5 strings of equal length
- [ ] Inter-letter spacing is 2 columns (default) between adjacent letters within a word
- [ ] Inter-word spacing is 4 columns (default) for the space character between words
- [ ] Total width of `renderText("HELLO WORLD")` is 70 columns (≤ 76)
- [ ] `renderText("XYZ")` throws an `Error` for unsupported characters
- [ ] `node --test test/renderer.test.js` passes all assertions
- [ ] No lint errors

## Constraints

- Do NOT modify any existing files (`package.json`, `lib/font.js`, `test/font.test.js`)
- Do NOT create any files other than `lib/renderer.js` and `test/renderer.test.js`
- Do NOT use any third-party dependencies — only `node:test` and `node:assert` for testing
- Do NOT add color logic — that is a separate task (T03-COLORIZER)
- Do NOT create `index.js` — that is a separate task (T04-ENTRYPOINT)
- Import from `./font.js` using relative ESM import (NOT `../lib/font.js` or bare specifier)
- All source uses ESM (`import`/`export`) — no CommonJS (`require`/`module.exports`)
