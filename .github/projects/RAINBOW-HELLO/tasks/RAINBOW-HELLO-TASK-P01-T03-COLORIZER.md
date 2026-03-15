---
project: "RAINBOW-HELLO"
phase: 1
task: 3
title: "Colors + Colorizer Module"
status: "pending"
skills_required: ["Node.js", "ESM", "chalk"]
skills_optional: []
estimated_files: 3
---

# Colors + Colorizer Module

## Objective

Create the rainbow color palette constants module (`lib/colors.js`) and the colorization module (`lib/colorizer.js`) that applies per-letter ANSI colors to composed ASCII art rows using chalk. Create comprehensive unit tests (`test/colorizer.test.js`) covering both modules.

## Context

The project is a Node.js 18+ ESM CLI app at `sample-apps/rainbow-hello/`. Two domain modules already exist: `lib/font.js` exports `GLYPHS` (8 character→5-row-string-array map) and `GLYPH_HEIGHT` (5), and `lib/renderer.js` exports `renderText(text, options)` which composes glyphs into 5-row art strings with inter-letter spacing (default 2) and inter-word spacing (default 4). All letter glyphs are exactly 5 columns wide; the space glyph is 4 columns wide. `renderText("HELLO WORLD")` produces 5 rows of 70 columns each. chalk v5 (`^5.4.0`) is already listed in `package.json` as the sole runtime dependency — it is ESM-only, provides `chalk.hex()` for RGB coloring, and auto-detects terminal color capability (respects `NO_COLOR`, `FORCE_COLOR`, `TERM=dumb`).

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `sample-apps/rainbow-hello/lib/colors.js` | Rainbow palette constants — leaf module, zero internal imports |
| CREATE | `sample-apps/rainbow-hello/lib/colorizer.js` | `colorize()` function — imports `colors.js` and `chalk` only |
| CREATE | `sample-apps/rainbow-hello/test/colorizer.test.js` | Unit tests for both `colors.js` exports and `colorize()` behavior |

## Implementation Steps

1. **Create `lib/colors.js`** — Export `RAINBOW_COLORS` as a 9-element array of hex strings and `LETTER_COLOR_MAP` as an 11-element array mapping each character of `"HELLO WORLD"` to its hex color (or `null` for the space at index 5). Use the exact hex values from the Styles & Design Tokens section below.

2. **Create `lib/colorizer.js`** — Import `chalk` (default import from `'chalk'`) and `LETTER_COLOR_MAP` from `'./colors.js'`. Export the `colorize(rows, text, options)` function per the contract below.

3. **Implement column-segment mapping in `colorize()`** — Walk through each character of `text`, tracking a cursor position. For each character:
   - If space: record a no-color segment of `wordSpacing` columns (default 4), advance cursor.
   - If letter and not first letter and previous character was not a space: record a no-color segment of `letterSpacing` columns (default 2), advance cursor.
   - If letter: record a colored segment of `GLYPH_WIDTH` (5) columns using `LETTER_COLOR_MAP[i]`, advance cursor.

4. **Apply colors to each row** — For each row string, iterate through the segments. For colored segments, use `chalk.hex(color)(row.slice(start, end))`. For no-color segments (spacing/gap), use `row.slice(start, end)` unchanged. Concatenate all slices to form the colored row string.

5. **Handle no-color mode** — Do NOT add manual `NO_COLOR` or `TERM` detection. chalk auto-detects terminal capability. When chalk's color level is 0, `chalk.hex(color)(text)` returns `text` unchanged, so the function naturally degrades.

6. **Create `test/colorizer.test.js`** — Import from `node:test` and `node:assert`. Import `RAINBOW_COLORS` and `LETTER_COLOR_MAP` from `../lib/colors.js`, `colorize` from `../lib/colorizer.js`, `renderText` from `../lib/renderer.js`, and `chalk` from `chalk`. Write the tests listed in the Test Requirements section below.

7. **Verify all tests pass** — Run `node --test test/colorizer.test.js` to confirm all new tests pass, then run `node --test test/` to confirm zero regressions across all 17+ existing tests.

## Contracts & Interfaces

### colors.js — Rainbow Palette Constants

```javascript
// sample-apps/rainbow-hello/lib/colors.js

/**
 * Ordered rainbow color palette as hex strings (9 entries).
 * @type {string[]}
 */
export const RAINBOW_COLORS = [
  '#FF0000',  // red
  '#FF7F00',  // orange
  '#FFFF00',  // yellow
  '#00FF00',  // green
  '#00FFFF',  // cyan
  '#0000FF',  // blue
  '#4B0082',  // indigo
  '#8B00FF',  // violet
  '#FF00FF',  // magenta
];

/**
 * Maps each character position in "HELLO WORLD" (11 chars) to its rainbow hex color.
 * Index 5 (the space between words) maps to null — no color applied.
 * @type {(string|null)[]}
 */
export const LETTER_COLOR_MAP = [
  '#FF0000',  // H  (index 0)  — red
  '#FF7F00',  // E  (index 1)  — orange
  '#FFFF00',  // L  (index 2)  — yellow
  '#00FF00',  // L  (index 3)  — green
  '#00FFFF',  // O  (index 4)  — cyan
  null,        // ' ' (index 5) — no color (word gap)
  '#0000FF',  // W  (index 6)  — blue
  '#4B0082',  // O  (index 7)  — indigo
  '#8B00FF',  // R  (index 8)  — violet
  '#FF00FF',  // L  (index 9)  — magenta
  '#FF0000',  // D  (index 10) — red (loop)
];
```

### colorizer.js — Color Application

```javascript
// sample-apps/rainbow-hello/lib/colorizer.js
import chalk from 'chalk';
import { LETTER_COLOR_MAP } from './colors.js';

/**
 * Apply per-letter rainbow ANSI colors to composed ASCII art rows.
 *
 * Each letter occupies a fixed column span (GLYPH_WIDTH = 5) in the art rows.
 * This function wraps each letter's column span with the corresponding
 * chalk.hex() RGB color. Inter-letter spacing columns and the word gap
 * receive no color wrapping.
 *
 * @param {string[]} rows — Array of 5 plain-text art row strings (from renderText).
 * @param {string} text — The original text string (e.g. "HELLO WORLD") for character-to-color mapping.
 * @param {object} [options]
 * @param {number} [options.letterSpacing=2] — Must match the spacing used in renderText.
 * @param {number} [options.wordSpacing=4] — Must match the spacing used in renderText.
 * @returns {string[]} — Array of 5 strings with ANSI color codes applied.
 *                        When chalk detects no color support, returns rows with no ANSI codes.
 */
export function colorize(rows, text, options) { /* ... */ }
```

### Column Layout Reference (for "HELLO WORLD", letterSpacing=2, wordSpacing=4)

The renderer produces rows of 70 columns. The colorizer must reconstruct these column segments:

```
Cols  0–4   → H  (LETTER_COLOR_MAP[0]  = #FF0000)
Cols  5–6   → inter-letter spacing     (no color)
Cols  7–11  → E  (LETTER_COLOR_MAP[1]  = #FF7F00)
Cols 12–13  → inter-letter spacing     (no color)
Cols 14–18  → L  (LETTER_COLOR_MAP[2]  = #FFFF00)
Cols 19–20  → inter-letter spacing     (no color)
Cols 21–25  → L  (LETTER_COLOR_MAP[3]  = #00FF00)
Cols 26–27  → inter-letter spacing     (no color)
Cols 28–32  → O  (LETTER_COLOR_MAP[4]  = #00FFFF)
Cols 33–36  → word gap                 (no color — LETTER_COLOR_MAP[5] = null)
Cols 37–41  → W  (LETTER_COLOR_MAP[6]  = #0000FF)
Cols 42–43  → inter-letter spacing     (no color)
Cols 44–48  → O  (LETTER_COLOR_MAP[7]  = #4B0082)
Cols 49–50  → inter-letter spacing     (no color)
Cols 51–55  → R  (LETTER_COLOR_MAP[8]  = #8B00FF)
Cols 56–57  → inter-letter spacing     (no color)
Cols 58–62  → L  (LETTER_COLOR_MAP[9]  = #FF00FF)
Cols 63–64  → inter-letter spacing     (no color)
Cols 65–69  → D  (LETTER_COLOR_MAP[10] = #FF0000)
```

### Existing Module Contracts (already built — do NOT modify these files)

```javascript
// sample-apps/rainbow-hello/lib/font.js — DO NOT IMPORT IN colorizer.js
export const GLYPH_HEIGHT = 5;  // number
export const GLYPHS = { /* 'H','E','L','O','W','R','D',' ' → string[] (5 rows each) */ };
// All letter glyphs: 5 columns wide. Space glyph: 4 columns wide.
```

```javascript
// sample-apps/rainbow-hello/lib/renderer.js — import in test file only
export function renderText(text, options);
// Returns string[] of 5 equal-length rows.
// Default: letterSpacing=2, wordSpacing=4.
// "HELLO WORLD" → 5 rows × 70 columns.
```

### Internal Constant in colorizer.js

```javascript
const GLYPH_WIDTH = 5;  // All letter glyphs are 5 columns wide (matches font.js)
```

This avoids importing `font.js` — the colorizer's only internal dependency is `colors.js`.

## Styles & Design Tokens

### Rainbow Color Palette (9 colors)

| Position | Token | Hex | RGB |
|----------|-------|-----|-----|
| 1 | `$rainbow-red` | `#FF0000` | `rgb(255, 0, 0)` |
| 2 | `$rainbow-orange` | `#FF7F00` | `rgb(255, 127, 0)` |
| 3 | `$rainbow-yellow` | `#FFFF00` | `rgb(255, 255, 0)` |
| 4 | `$rainbow-green` | `#00FF00` | `rgb(0, 255, 0)` |
| 5 | `$rainbow-cyan` | `#00FFFF` | `rgb(0, 255, 255)` |
| 6 | `$rainbow-blue` | `#0000FF` | `rgb(0, 0, 255)` |
| 7 | `$rainbow-indigo` | `#4B0082` | `rgb(75, 0, 130)` |
| 8 | `$rainbow-violet` | `#8B00FF` | `rgb(139, 0, 255)` |
| 9 | `$rainbow-magenta` | `#FF00FF` | `rgb(255, 0, 255)` |

### Letter-to-Color Mapping ("HELLO WORLD" — 11 characters)

| Index | Character | Color | Hex |
|-------|-----------|-------|-----|
| 0 | H | red | `#FF0000` |
| 1 | E | orange | `#FF7F00` |
| 2 | L | yellow | `#FFFF00` |
| 3 | L | green | `#00FF00` |
| 4 | O | cyan | `#00FFFF` |
| 5 | (space) | — | `null` |
| 6 | W | blue | `#0000FF` |
| 7 | O | indigo | `#4B0082` |
| 8 | R | violet | `#8B00FF` |
| 9 | L | magenta | `#FF00FF` |
| 10 | D | red (loop) | `#FF0000` |

### Layout Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `$letter-height` | `5` rows | Glyph height — colorize receives 5-row arrays |
| `$letter-spacing` | `2` columns | Inter-letter gap — no color applied |
| `$word-spacing` | `4` columns | Word gap — no color applied |
| `GLYPH_WIDTH` | `5` columns | All letter glyphs are 5 columns wide |

## Test Requirements

All tests use `node:test` (`describe`, `it`) and `node:assert` (`strictEqual`, `deepStrictEqual`, `ok`, `match`). Save to `sample-apps/rainbow-hello/test/colorizer.test.js`.

### colors.js tests

- [ ] `RAINBOW_COLORS` is an array of exactly 9 elements
- [ ] `RAINBOW_COLORS` entries match the exact hex values in order: `['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#4B0082', '#8B00FF', '#FF00FF']`
- [ ] `LETTER_COLOR_MAP` is an array of exactly 11 elements
- [ ] `LETTER_COLOR_MAP[5]` is `null` (the space between words)
- [ ] All non-null entries in `LETTER_COLOR_MAP` are strings starting with `#`

### colorizer.js tests

- [ ] `colorize()` returns an array of exactly 5 strings when given 5 input rows
- [ ] With chalk color forced on (`chalk.level = 3` before calling), output strings contain ANSI escape sequences (match `/\x1b\[/`)
- [ ] With chalk color forced on, the word-gap columns (columns 33–36 for "HELLO WORLD" default spacing) contain NO ANSI escape codes — extract those columns from a single-color-free check
- [ ] With chalk color level set to 0 (`chalk.level = 0` before calling), output rows equal the input rows exactly (no ANSI codes, unchanged strings)

### Test structure

```javascript
// test/colorizer.test.js
import { describe, it, before, after } from 'node:test';
import { strictEqual, deepStrictEqual, ok, match } from 'node:assert';
import chalk from 'chalk';
import { RAINBOW_COLORS, LETTER_COLOR_MAP } from '../lib/colors.js';
import { colorize } from '../lib/colorizer.js';
import { renderText } from '../lib/renderer.js';

// Use renderText("HELLO WORLD") to produce test input rows.
// Save/restore chalk.level around color-dependent tests.
```

## Acceptance Criteria

- [ ] `sample-apps/rainbow-hello/lib/colors.js` exists and exports `RAINBOW_COLORS` (9-element hex array) and `LETTER_COLOR_MAP` (11-element array with `null` at index 5)
- [ ] `RAINBOW_COLORS` contains exactly: `['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#4B0082', '#8B00FF', '#FF00FF']`
- [ ] `LETTER_COLOR_MAP` contains exactly: `['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#00FFFF', null, '#0000FF', '#4B0082', '#8B00FF', '#FF00FF', '#FF0000']`
- [ ] `sample-apps/rainbow-hello/lib/colorizer.js` exists and exports `colorize` as a named ESM export
- [ ] `colorize()` returns 5 strings with ANSI color codes when chalk color is supported
- [ ] Word-gap columns between "HELLO" and "WORLD" have no ANSI color codes applied
- [ ] When chalk color level is 0, `colorize()` returns rows unchanged (identical to input)
- [ ] `node --test test/colorizer.test.js` passes all assertions
- [ ] `node --test test/` passes all tests (font + renderer + colorizer) with zero regressions
- [ ] No lint errors

## Constraints

- Do NOT modify any existing files (`package.json`, `lib/font.js`, `lib/renderer.js`, `test/font.test.js`, `test/renderer.test.js`)
- Do NOT import `font.js` from `colorizer.js` — use the internal `GLYPH_WIDTH = 5` constant instead
- Do NOT add manual `NO_COLOR` / `TERM` detection — rely entirely on chalk's built-in auto-detection
- Do NOT add any new dependencies — chalk is already in `package.json`
- Do NOT create `index.js`, `animator.js`, or any files outside the three listed targets
- Use only `node:test` and `node:assert` for tests — no third-party test frameworks
- All files must use ESM syntax (`import`/`export`) — no CommonJS
