---
project: "RAINBOW-HELLO"
phase: 1
task: 1
title: "Project Scaffold + Font Module"
status: "pending"
skills_required: ["Node.js", "ESM"]
skills_optional: []
estimated_files: 3
---

# Project Scaffold + Font Module

## Objective

Create the project foundation (`package.json` with ESM config and chalk dependency) and the first leaf domain module (`font.js`) containing hardcoded 5-row ASCII art glyphs for 8 characters, along with unit tests validating glyph structure.

## Context

This is a zero-build Node.js 18+ CLI project at `sample-apps/rainbow-hello/`. It uses ESM modules (`"type": "module"` in `package.json`). The font module is a leaf dependency with zero internal imports — other modules (`renderer.js`, `colorizer.js`) will import from it in later tasks. Tests use only Node.js built-in `node:test` and `node:assert` — no test frameworks. chalk v5 is declared as a dependency now but not used in this task.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `sample-apps/rainbow-hello/package.json` | Project metadata, ESM config, chalk dependency, start/test scripts |
| CREATE | `sample-apps/rainbow-hello/lib/font.js` | GLYPHS map (8 characters → 5-row string arrays) and GLYPH_HEIGHT constant |
| CREATE | `sample-apps/rainbow-hello/test/font.test.js` | Unit tests validating glyph structure using node:test and node:assert |

## Implementation Steps

1. **Create `sample-apps/rainbow-hello/package.json`** with the exact structure specified in the Contracts section below. Ensure `"type": "module"` is set, chalk `^5.4.0` is in dependencies, and both `start` and `test` scripts are defined.

2. **Create `sample-apps/rainbow-hello/lib/font.js`** exporting `GLYPHS` and `GLYPH_HEIGHT`. Define all 8 glyphs (H, E, L, O, W, R, D, space) exactly as specified in the Design Tokens section below. Each glyph must be an array of exactly 5 strings. All rows within a single glyph must have equal length. Letter glyphs are 5 columns wide; the space glyph is 4 columns wide.

3. **Create `sample-apps/rainbow-hello/test/font.test.js`** with the test cases listed in Test Requirements. Import `GLYPHS` and `GLYPH_HEIGHT` from `../lib/font.js`. Use `node:test` (`describe`, `it`) and `node:assert` (`strictEqual`, `ok`, `deepStrictEqual`).

4. **Validate all glyph rows are exact** — double-check that every row string in each glyph has the correct width (5 for letters, 4 for space) and uses only the letter's own character and space characters.

5. **Verify the test file runs** — the test command is `node --test test/font.test.js` from the `sample-apps/rainbow-hello/` directory.

## Contracts & Interfaces

### package.json

```json
{
  "name": "rainbow-hello",
  "version": "1.0.0",
  "description": "Display HELLO WORLD in rainbow ASCII art",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "test": "node --test test/"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "chalk": "^5.4.0"
  }
}
```

### font.js Exports

```javascript
// sample-apps/rainbow-hello/lib/font.js

/**
 * @typedef {string[]} Glyph — Array of exactly 5 strings, each representing one row of the letter.
 *                              All rows within a glyph have equal length.
 */

/**
 * Map of supported characters to their 5-row ASCII art glyphs.
 * Keys: 'H', 'E', 'L', 'O', 'W', 'R', 'D', ' '
 * @type {Record<string, Glyph>}
 */
export const GLYPHS;

/**
 * Number of rows per glyph (constant: 5).
 * @type {number}
 */
export const GLYPH_HEIGHT;
```

## Styles & Design Tokens

### ASCII Art Glyph Definitions

Each glyph is exactly **5 rows tall**. Letter glyphs are **5 columns wide**. Space glyph is **4 columns wide**. Each row uses only the letter's own character and space characters.

| Letter | Width | Row 0 | Row 1 | Row 2 | Row 3 | Row 4 |
|--------|-------|-------|-------|-------|-------|-------|
| `H` | 5 | `"H   H"` | `"H   H"` | `"HHHHH"` | `"H   H"` | `"H   H"` |
| `E` | 5 | `"EEEEE"` | `"E    "` | `"EEEE "` | `"E    "` | `"EEEEE"` |
| `L` | 5 | `"L    "` | `"L    "` | `"L    "` | `"L    "` | `"LLLLL"` |
| `O` | 5 | `" OOO "` | `"O   O"` | `"O   O"` | `"O   O"` | `" OOO "` |
| `W` | 5 | `"W   W"` | `"W   W"` | `"W W W"` | `"WW WW"` | `" W W "` |
| `R` | 5 | `"RRRR "` | `"R   R"` | `"RRRR "` | `"R  R "` | `"R   R"` |
| `D` | 5 | `"DDDD "` | `"D   D"` | `"D   D"` | `"D   D"` | `"DDDD "` |
| `(space)` | 4 | `"    "` | `"    "` | `"    "` | `"    "` | `"    "` |

### Layout Tokens (for reference — not used in this task, but glyph dimensions must be consistent with these)

- `$letter-height`: `5` rows — number of text rows per ASCII art letter
- `$letter-spacing`: `2` columns — space characters between adjacent letters in a word
- `$word-spacing`: `4` columns — space characters between "HELLO" and "WORLD"

## Test Requirements

- [ ] `GLYPHS` contains exactly 8 keys: `'H'`, `'E'`, `'L'`, `'O'`, `'W'`, `'R'`, `'D'`, `' '`
- [ ] Every glyph value is an array of exactly 5 strings
- [ ] All rows within each glyph have equal length (consistent width per letter)
- [ ] Letter glyphs (`H`, `E`, `L`, `O`, `W`, `R`, `D`) have rows of width 5
- [ ] Space glyph (`' '`) has rows of width 4
- [ ] `GLYPH_HEIGHT` is exported and equals `5`
- [ ] Each glyph row contains only the letter's own character and space characters (e.g., `H` glyph rows contain only `'H'` and `' '`)

## Acceptance Criteria

- [ ] `package.json` exists at `sample-apps/rainbow-hello/package.json` with `"type": "module"`
- [ ] `package.json` has `chalk` `^5.4.0` in `dependencies`
- [ ] `package.json` has `"start": "node index.js"` and `"test": "node --test test/"` scripts
- [ ] `package.json` has `"engines": { "node": ">=18.0.0" }`
- [ ] `font.js` exports `GLYPHS` with exactly 8 character keys (`H`, `E`, `L`, `O`, `W`, `R`, `D`, ` `)
- [ ] `font.js` exports `GLYPH_HEIGHT` with value `5`
- [ ] Every glyph has exactly 5 rows with consistent width per glyph
- [ ] `node --test test/font.test.js` passes all assertions (run from `sample-apps/rainbow-hello/`)
- [ ] No lint errors

## Constraints

- Do NOT create `index.js`, `renderer.js`, `colors.js`, `colorizer.js`, or `animator.js` — those belong to later tasks
- Do NOT install dependencies or run `npm install` — that is the Coder's responsibility at execution time, not a file creation step
- Do NOT use any test framework other than Node.js built-in `node:test` and `node:assert`
- Do NOT add any runtime dependencies other than `chalk` in `package.json`
- Do NOT add `devDependencies` — testing uses only Node.js built-ins
- Do NOT use CommonJS (`require`/`module.exports`) — all files must use ESM (`import`/`export`)
- Do NOT reference external planning documents — this handoff is the sole input
