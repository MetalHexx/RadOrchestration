---
project: "RAINBOW-HELLO"
total_phases: 2
status: "draft"
author: "architect-agent"
created: "2026-03-15"
---

# RAINBOW-HELLO — Master Plan

## Executive Summary

RAINBOW-HELLO is a zero-dependency-beyond-chalk Node.js 18+ CLI application that displays "HELLO WORLD" as 5-line-tall ASCII block art with per-letter rainbow ANSI coloring. The system uses ESM modules, hardcoded letter glyphs, and chalk v5 for cross-platform terminal color detection with graceful degradation. Delivery is split into two phases: Phase 1 produces the core static rainbow ASCII art output with full test coverage, and Phase 2 adds a character-by-character animated reveal effect with cursor management and signal safety. The project lives in `sample-apps/rainbow-hello/` and also serves as an end-to-end exercise of the orchestration pipeline.

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [RAINBOW-HELLO-BRAINSTORMING.md](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-BRAINSTORMING.md) | ✅ |
| Research | [RAINBOW-HELLO-RESEARCH-FINDINGS.md](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-RESEARCH-FINDINGS.md) | ✅ |
| PRD | [RAINBOW-HELLO-PRD.md](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-PRD.md) | ✅ |
| Design | [RAINBOW-HELLO-DESIGN.md](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-DESIGN.md) | ✅ |
| Architecture | [RAINBOW-HELLO-ARCHITECTURE.md](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-ARCHITECTURE.md) | ✅ |

## Key Requirements (from PRD)

- **FR-1**: The application SHALL display "HELLO WORLD" in large ASCII art letters (minimum 5 lines tall) when invoked via `node index.js` or `npm start`
- **FR-2**: Each letter SHALL be rendered in a distinct rainbow spectrum color (red → orange → yellow → green → cyan → blue → indigo → violet → magenta), looping as needed
- **FR-3**: The space between "HELLO" and "WORLD" SHALL NOT be colored
- **FR-5**: The application SHALL be invocable via `node index.js` or `npm start`
- **FR-9**: ASCII art output SHALL use only printable ASCII characters (no Unicode)
- **FR-10**: Unit tests for all core output-generation logic using Node.js built-in test runner only
- **NFR-5**: No more than one external runtime dependency (chalk)
- **NFR-9**: ESM modules (`"type": "module"`) for all source files

## Key Technical Decisions (from Architecture)

- **Hardcoded letter glyphs over figlet**: Custom 5-row ASCII glyphs for 8 characters (H, E, L, O, W, R, D, space) avoid the 18.8 MB figlet dependency while maintaining full control over letter design
- **chalk v5 (ESM-only) as sole external dependency**: Provides cross-platform terminal color auto-detection, RGB/256/16-color output, and graceful degradation — 44 kB unpacked, zero transitive dependencies
- **Pure-function domain layer**: `font.js`, `renderer.js`, `colors.js`, and `colorizer.js` are pure functions with no I/O or side effects, enabling straightforward unit testing with `node:test`
- **Composition root pattern**: `index.js` is the sole composition point — imports domain modules, wires them together, and handles stdout. No dependency injection framework
- **Injectable stream for animation testing**: `animator.js` accepts an optional `stream` parameter to avoid writing to real stdout during tests
- **Module dependency direction**: Leaf modules (`font.js`, `colors.js`) have zero internal imports; `renderer.js` depends only on `font.js`; `colorizer.js` depends on `colors.js` + chalk; `animator.js` depends on `colorizer.js`

## Key Design Constraints (from Design)

- **5-line-tall variable-width block letters**: Each glyph is exactly 5 rows tall with consistent width per letter, using only the letter's own character and spaces
- **Inter-letter spacing of 2 columns, inter-word spacing of 4 columns**: Ensures letters don't merge while keeping total width ≤ 76 characters (fits 80-column terminal)
- **9-color rainbow palette with specific hex values**: Red `#FF0000`, Orange `#FF7F00`, Yellow `#FFFF00`, Green `#00FF00`, Cyan `#00FFFF`, Blue `#0000FF`, Indigo `#4B0082`, Violet `#8B00FF`, Magenta `#FF00FF`
- **Top and bottom margin of 1 blank line each**: Total output height is 7 lines (1 + 5 + 1)
- **`NO_COLOR` and `TERM=dumb` compliance**: When detected, emit zero ANSI escape codes — chalk handles this automatically
- **Phase 2 animation: column-based reveal at 150 ms per letter, 0 ms for space gap**: Each frame redraws all 5 rows; cursor hidden during animation and restored on completion or signal interrupt
- **Non-TTY fallback**: When stdout is not a TTY (piped output), skip animation and produce static output
- **Cursor restoration on SIGINT/SIGTERM**: Register signal handlers to write `\x1b[?25h` before exit during animation

## Phase Outline

### Phase 1: Core ASCII Art + Rainbow Colors

**Goal**: Deliver the static "HELLO WORLD" rainbow ASCII art CLI — run once, display colored art, exit.

**Scope**:
- `package.json` with project metadata, `"type": "module"`, chalk dependency, `start` and `test` scripts — refs: [Architecture: package.json](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-ARCHITECTURE.md#packagejson-structure)
- `lib/font.js` — 8 letter glyphs (H, E, L, O, W, R, D, space) as 5-row string arrays — refs: [FR-1](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-PRD.md#functional-requirements), [Architecture: font.js](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-ARCHITECTURE.md#fontjs--glyph-data)
- `lib/renderer.js` — `renderText()` art composition with letter/word spacing — refs: [FR-9](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-PRD.md#functional-requirements), [Architecture: renderer.js](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-ARCHITECTURE.md#rendererjs--art-composition)
- `lib/colors.js` — `RAINBOW_COLORS` and `LETTER_COLOR_MAP` constants — refs: [Design: Rainbow Palette](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-DESIGN.md#rainbow-color-palette), [Architecture: colors.js](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-ARCHITECTURE.md#colorsjs--rainbow-palette)
- `lib/colorizer.js` — `colorize()` per-letter chalk RGB color application — refs: [FR-2](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-PRD.md#functional-requirements), [FR-3](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-PRD.md#functional-requirements), [Architecture: colorizer.js](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-ARCHITECTURE.md#colorizerjs--color-application)
- `index.js` — static entrypoint: render → colorize → print with margins — refs: [FR-4](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-PRD.md#functional-requirements), [FR-5](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-PRD.md#functional-requirements), [Architecture: index.js](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-ARCHITECTURE.md#indexjs--entrypoint)
- `test/font.test.js` — glyph structure validation (height, width consistency) — refs: [FR-10](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-PRD.md#functional-requirements)
- `test/renderer.test.js` — art composition, spacing, unknown character error — refs: [FR-10](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-PRD.md#functional-requirements)
- `test/colorizer.test.js` — color application, no-color fallback — refs: [FR-10](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-PRD.md#functional-requirements)
- `README.md` — installation and usage instructions — refs: [FR-6](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-PRD.md#functional-requirements)

**Exit Criteria**:
- [ ] `node index.js` displays "HELLO WORLD" in rainbow-colored 5-line ASCII art
- [ ] `npm test` passes all tests (font, renderer, colorizer)
- [ ] Output degrades gracefully with `NO_COLOR=1` (plain monochrome art, no ANSI codes)
- [ ] Total output width ≤ 80 columns
- [ ] Only one external runtime dependency (chalk) in `package.json`
- [ ] `package.json` has `"type": "module"` and valid `start`/`test` scripts

**Phase Doc**: `phases/RAINBOW-HELLO-PHASE-01-CORE-ASCII-ART.md` *(created at execution time)*

---

### Phase 2: Character-by-Character Rainbow Reveal

**Goal**: Add an animated reveal effect where letters appear one at a time with rainbow colors, building on the Phase 1 static output.

**Scope**:
- `lib/animator.js` — `animate()` function with timed letter-by-letter reveal, cursor hide/show, SIGINT/SIGTERM signal safety, injectable stream — refs: [FR-8](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-PRD.md#functional-requirements), [Architecture: animator.js](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-ARCHITECTURE.md#animatorjs--phase-2-reveal-controller), [Design: Animation Sequence](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-DESIGN.md#animation-sequence-detail-phase-2)
- `index.js` — update entrypoint to use `animate()` with non-TTY fallback to static output — refs: [Design: Responsive Behavior](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-DESIGN.md#responsive-behavior)
- `test/animator.test.js` — animation sequencing, timing, cursor management, stream injection — refs: [FR-10](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-PRD.md#functional-requirements)
- `README.md` — update with animation description and non-TTY behavior — refs: [FR-6](.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-PRD.md#functional-requirements)

**Exit Criteria**:
- [ ] `node index.js` in a TTY displays the animated character-by-character rainbow reveal
- [ ] Animation completes in under 5 seconds (NFR-2)
- [ ] Cursor is restored after animation completes normally
- [ ] Cursor is restored on SIGINT (Ctrl+C) during animation
- [ ] Non-TTY execution (piped stdout) falls back to Phase 1 static output
- [ ] `npm test` passes all tests including animator tests
- [ ] README documents animation behavior and non-TTY fallback

**Phase Doc**: `phases/RAINBOW-HELLO-PHASE-02-ANIMATION.md` *(created at execution time)*

---

## Execution Constraints

- **Max phases**: 10 (from orchestration.yml — this project uses 2)
- **Max tasks per phase**: 8
- **Max retries per task**: 2
- **Git strategy**: Single branch, `[orch]` commit prefix, auto-commit enabled
- **Human gates**: After planning (master plan review) and after final review; execution mode: "ask"

## Risk Register

| Risk | Impact | Mitigation | Owner |
|------|--------|-----------|-------|
| Terminal color rendering varies across platforms, causing inconsistent visual output | Medium | chalk v5 auto-detects terminal capability and downsamples colors; `NO_COLOR` and `TERM=dumb` respected | Coder |
| Hardcoded ASCII art may look misaligned depending on font and terminal width | Medium | Design art at ≤ 76 columns (fits 80-column terminal); test in multiple terminal emulators | Coder / Reviewer |
| Animation timing (Phase 2) may appear jittery across systems | Low | Use simple `setTimeout`-based delays at 150 ms; total animation ~1.5 s, well within 5 s safety bound | Coder |
| Cursor left hidden if animation crashes or is killed unexpectedly | Medium | Register SIGINT/SIGTERM handlers to restore cursor via `\x1b[?25h` before exit | Coder |
| Scope creep toward user-configurable options beyond hardcoded message | Low | Non-goals explicitly defined in PRD; enforce during code review | Reviewer |
