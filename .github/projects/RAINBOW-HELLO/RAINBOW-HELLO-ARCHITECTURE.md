---
project: "RAINBOW-HELLO"
status: "draft"
author: "architect-agent"
created: "2026-03-15"
---

# RAINBOW-HELLO — Architecture

## Technical Overview

RAINBOW-HELLO is a zero-build Node.js 18+ CLI application using ESM modules that renders "HELLO WORLD" as 5-line-tall ASCII block art with per-letter rainbow ANSI coloring. The system uses chalk v5 (ESM-only, zero transitive dependencies) for cross-platform terminal color detection and graceful degradation, with hardcoded letter glyphs to avoid the 18.8 MB figlet dependency. The architecture separates glyph data, art composition, colorization, and animation into distinct modules with pure-function contracts so that each can be unit-tested independently with `node:test` and `node:assert`.

## System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│     Presentation                                                │
│     index.js — CLI entrypoint, stdout output, process lifecycle │
├─────────────────────────────────────────────────────────────────┤
│     Application                                                 │
│     animator.js — Phase 2 reveal sequencing, cursor mgmt        │
├─────────────────────────────────────────────────────────────────┤
│     Domain                                                      │
│     font.js, renderer.js, colorizer.js, colors.js — pure logic │
├─────────────────────────────────────────────────────────────────┤
│     Infrastructure                                              │
│     chalk — terminal capability detection, ANSI code generation │
└─────────────────────────────────────────────────────────────────┘
```

- **Presentation**: The single CLI entrypoint that composes domain modules, writes to stdout, and manages process exit.
- **Application**: The animation controller (Phase 2) that orchestrates timed, stateful output sequences using domain-layer primitives.
- **Domain**: Pure functions and data — letter glyphs, art composition, color palette, colorization logic. No I/O, no side effects. Fully testable.
- **Infrastructure**: The chalk library, accessed only through the colorizer module, providing terminal capability detection and ANSI escape code generation.

## Module Map

| Module | Layer | Path | Responsibility |
|--------|-------|------|---------------|
| `index.js` | Presentation | `sample-apps/rainbow-hello/index.js` | CLI entrypoint. Imports domain modules, calls renderer and colorizer, writes to stdout, exits. Phase 2: delegates to animator. |
| `font.js` | Domain | `sample-apps/rainbow-hello/lib/font.js` | Exports `GLYPHS` — a map of character → 5-row string array for each letter (H, E, L, O, W, R, D) and space. |
| `renderer.js` | Domain | `sample-apps/rainbow-hello/lib/renderer.js` | Exports `renderText()` — composes individual letter glyphs into a multi-line ASCII art string array with inter-letter and inter-word spacing. |
| `colors.js` | Domain | `sample-apps/rainbow-hello/lib/colors.js` | Exports `RAINBOW_COLORS` — the ordered array of hex color values for the rainbow palette, and `LETTER_COLOR_MAP` — per-character color assignments. |
| `colorizer.js` | Domain | `sample-apps/rainbow-hello/lib/colorizer.js` | Exports `colorize()` — applies per-letter-column rainbow ANSI colors to art row strings using chalk. Skips the space gap. Returns colored string array. |
| `animator.js` | Application | `sample-apps/rainbow-hello/lib/animator.js` | Exports `animate()` — Phase 2 character-by-character reveal controller. Manages cursor visibility, timed delays, and progressive rendering. |

## Contracts & Interfaces

### font.js — Glyph Data

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

### renderer.js — Art Composition

```javascript
// sample-apps/rainbow-hello/lib/renderer.js

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
export function renderText(text, options);
```

### colors.js — Rainbow Palette

```javascript
// sample-apps/rainbow-hello/lib/colors.js

/**
 * Ordered rainbow color palette as hex strings.
 * @type {string[]}
 */
export const RAINBOW_COLORS; // ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#4B0082', '#8B00FF', '#FF00FF']

/**
 * Maps each character position in "HELLO WORLD" to its rainbow color hex value.
 * Index 5 (space) maps to null (no color).
 * @type {(string|null)[]}
 */
export const LETTER_COLOR_MAP; // ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#00FFFF', null, '#0000FF', '#4B0082', '#8B00FF', '#FF00FF', '#FF0000']
```

### colorizer.js — Color Application

```javascript
// sample-apps/rainbow-hello/lib/colorizer.js

/**
 * Apply per-letter rainbow ANSI colors to composed ASCII art rows.
 *
 * Each letter occupies a fixed column span in the art rows. This function
 * wraps each letter's column span with the corresponding chalk RGB color.
 * The space gap between words receives no color wrapping.
 *
 * @param {string[]} rows — Array of 5 plain-text art row strings (from renderText).
 * @param {string} text — The original text string (e.g. "HELLO WORLD") for character-to-color mapping.
 * @param {object} [options]
 * @param {number} [options.letterSpacing=2] — Must match the spacing used in renderText.
 * @param {number} [options.wordSpacing=4] — Must match the spacing used in renderText.
 * @returns {string[]} — Array of 5 strings with ANSI color codes applied. In no-color mode, returns rows unchanged.
 */
export function colorize(rows, text, options);
```

### animator.js — Phase 2 Reveal Controller

```javascript
// sample-apps/rainbow-hello/lib/animator.js

/**
 * Animate the rainbow ASCII art reveal character-by-character.
 *
 * Hides the cursor, reveals each letter across all 5 rows simultaneously
 * with a timed delay, then restores the cursor. The space gap is rendered
 * instantly with no delay.
 *
 * Registers SIGINT/SIGTERM handlers to restore cursor on unexpected exit.
 *
 * @param {string[]} rows — Array of 5 plain-text art row strings (from renderText).
 * @param {string} text — The original text string for character-to-color mapping.
 * @param {object} [options]
 * @param {number} [options.delay=150] — Milliseconds between each letter reveal.
 * @param {number} [options.letterSpacing=2] — Must match the spacing used in renderText.
 * @param {number} [options.wordSpacing=4] — Must match the spacing used in renderText.
 * @param {NodeJS.WriteStream} [options.stream=process.stdout] — Output stream (injectable for testing).
 * @returns {Promise<void>} — Resolves when animation is complete.
 */
export async function animate(rows, text, options);
```

### index.js — Entrypoint

```javascript
// sample-apps/rainbow-hello/index.js

// Phase 1: Static output
// 1. Call renderText("HELLO WORLD") → rows
// 2. Call colorize(rows, "HELLO WORLD") → coloredRows
// 3. Print blank line (top margin)
// 4. Print each coloredRow to stdout
// 5. Print blank line (bottom margin)
// 6. Process exits naturally

// Phase 2: Animated output (replaces Phase 1 main flow)
// 1. Call renderText("HELLO WORLD") → rows
// 2. Print blank line (top margin)
// 3. Call animate(rows, "HELLO WORLD") → awaits completion
// 4. Print blank line (bottom margin)
// 5. Process exits naturally
```

## API Endpoints

Not applicable — this is a CLI application with no HTTP server or API surface.

## Dependencies

### External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `chalk` | `^5.4.0` | Terminal color support with auto-detection, RGB/256/16-color output, graceful degradation on limited terminals. ESM-only. Zero transitive dependencies. |

No other runtime dependencies. Testing uses only Node.js built-ins (`node:test`, `node:assert`).

### Internal Dependencies (module → module)

```
index.js → renderer.js → font.js
index.js → colorizer.js → colors.js
                        → chalk (external)
index.js → animator.js  → colorizer.js → colors.js
                                        → chalk (external)
```

Dependency rules:
- `font.js` and `colors.js` are leaf modules with zero internal imports
- `renderer.js` depends only on `font.js`
- `colorizer.js` depends on `colors.js` and `chalk`
- `animator.js` depends on `colorizer.js` (and transitively `colors.js`, `chalk`)
- `index.js` is the composition root — it imports `renderer.js`, `colorizer.js`, and (Phase 2) `animator.js`

## File Structure

```
sample-apps/rainbow-hello/
├── index.js                    # CLI entrypoint — composition root
├── package.json                # Project metadata, "type": "module", start script
├── README.md                   # Installation and usage instructions
├── lib/
│   ├── font.js                 # GLYPHS map — letter glyph definitions (5-row string arrays)
│   ├── renderer.js             # renderText() — composes glyphs into multi-line art
│   ├── colors.js               # RAINBOW_COLORS, LETTER_COLOR_MAP — palette constants
│   ├── colorizer.js            # colorize() — applies chalk RGB colors to art rows
│   └── animator.js             # animate() — Phase 2 character-by-character reveal
└── test/
    ├── font.test.js            # Validates glyph structure (height, width consistency)
    ├── renderer.test.js        # Validates art composition, spacing, unknown char error
    ├── colorizer.test.js       # Validates color application, no-color fallback
    └── animator.test.js        # Validates animation sequencing (Phase 2)
```

### package.json Structure

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

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| Error handling | Minimal — input is hardcoded, so invalid-input paths are unlikely at runtime. `renderText()` throws on unknown characters as a developer safety net. The entrypoint does not wrap in try/catch; unhandled errors produce a natural Node.js stack trace and non-zero exit code. |
| Terminal color detection | Delegated entirely to chalk. chalk auto-detects terminal capability (truecolor → 256 → 16 → none) and respects `NO_COLOR`, `FORCE_COLOR`, and `TERM=dumb`. No custom detection code needed. |
| Cursor safety (Phase 2) | `animate()` registers `process.on('SIGINT')` and `process.on('SIGTERM')` handlers that write `\x1b[?25h` (show cursor) to stdout before `process.exit()`. This ensures the cursor is restored even if the user presses Ctrl+C during animation. |
| Testability | All domain modules (`font.js`, `renderer.js`, `colors.js`, `colorizer.js`) export pure functions with no side effects. `animator.js` accepts an injectable `stream` option to avoid writing to real stdout during tests. |
| Logging | None — this is a single-purpose CLI that writes its output and exits. No logging framework or debug output. |
| Authentication | Not applicable. |
| State management | No persistent state. The application runs, produces output, and exits. Phase 2 animation state (current letter index, cursor visibility) is local to the `animate()` function's execution scope. |

## Phasing Recommendations

The following phasing aligns with the PRD's explicit 2-phase requirement and the natural dependency graph of the modules:

### Phase 1 — Core ASCII Art + Rainbow Colors (Static)

**Goal**: Display "HELLO WORLD" in large rainbow-colored ASCII art on a single invocation.

**Scope**:
- `package.json` with metadata, ESM config, chalk dependency, start/test scripts
- `lib/font.js` — all 8 glyphs (H, E, L, O, W, R, D, space)
- `lib/renderer.js` — `renderText()` function
- `lib/colors.js` — rainbow palette constants
- `lib/colorizer.js` — `colorize()` function
- `index.js` — static output entrypoint (render → colorize → print)
- `test/font.test.js` — glyph structure validation
- `test/renderer.test.js` — art composition tests
- `test/colorizer.test.js` — color application tests
- `README.md` — installation and usage

**Exit criteria**:
- `node index.js` displays rainbow-colored ASCII art "HELLO WORLD"
- `npm test` passes all tests
- Output degrades gracefully with `NO_COLOR=1`
- Total output width ≤ 80 columns

### Phase 2 — Character-by-Character Rainbow Reveal (Animation)

**Goal**: Add an animated reveal effect where letters appear one at a time with rainbow colors.

**Scope**:
- `lib/animator.js` — `animate()` function with timing, cursor management, signal handlers
- `index.js` — update entrypoint to use `animate()` instead of static output
- `test/animator.test.js` — animation sequencing tests
- Non-TTY fallback: detect `!process.stdout.isTTY` and fall back to Phase 1 static output

**Exit criteria**:
- `node index.js` displays animated reveal on TTY terminals
- `node index.js` falls back to static output when piped
- Cursor is restored after animation and on SIGINT/SIGTERM
- `npm test` passes all tests including animator tests
- Total animation duration < 5,000 ms
