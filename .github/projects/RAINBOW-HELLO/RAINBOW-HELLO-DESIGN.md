---
project: "RAINBOW-HELLO"
status: "draft"
author: "ux-designer-agent"
created: "2026-03-15"
---

# RAINBOW-HELLO — Design

## Design Overview

The user experience is a single-command CLI invocation that produces a visually striking terminal output: "HELLO WORLD" rendered in large block-style ASCII art letters, each letter colored in a distinct rainbow hue using ANSI escape sequences. In Phase 1 the output is static and immediate; in Phase 2 a character-by-character reveal animation adds dynamism, with each letter appearing sequentially across the rainbow spectrum. When terminal color support is limited, the output degrades gracefully to readable plain-text ASCII art.

## User Flows

### Flow 1 — Static Rainbow Greeting (Phase 1)

```
User runs `node index.js` or `npm start`
  → Application detects terminal color capability
  → Generates 5-line-tall ASCII art for "HELLO WORLD"
  → Applies rainbow color to each letter column (red → orange → yellow → green → cyan → [space] → blue → indigo → violet → magenta → red)
  → Writes all lines to stdout in a single batch
  → Process exits with code 0
```

The entire output appears instantly. Total wall-clock time is under 200 ms.

### Flow 2 — Animated Rainbow Reveal (Phase 2)

```
User runs `node index.js` or `npm start`
  → Application detects terminal color capability
  → Hides terminal cursor
  → Reveals letters one at a time (left → right), each in its rainbow color
  → Brief delay (~150 ms) between each letter reveal
  → After all letters are revealed, shows cursor and prints a trailing newline
  → Process exits with code 0
```

Total animation duration is approximately 1.5 s (11 characters × ~150 ms, excluding the space gap). The space between "HELLO" and "WORLD" is revealed as an uncolored gap with no delay.

### Flow 3 — Graceful Degradation (Both Phases)

```
Terminal lacks color support (e.g., dumb terminal, CI pipe, NO_COLOR env)
  → Application detects limited/no color capability (via chalk auto-detection)
  → Renders ASCII art with NO ANSI color codes
  → Output is plain monochrome block letters, still fully readable
  → Process exits with code 0
```

The application respects the `NO_COLOR` environment variable (https://no-color.org/) and `TERM=dumb`.

## Layout & Components

### Terminal Output Layout

**Target terminal width**: 80 columns minimum (conservative default). The ASCII art is designed to fit within 80 columns.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  H   H  EEEEE  L      L       OOO        W   W   OOO   RRRR   L      DDDD      │
│  H   H  E      L      L      O   O       W   W  O   O  R   R  L      D   D     │
│  HHHHH  EEEE   L      L      O   O       W W W  O   O  RRRR   L      D   D     │
│  H   H  E      L      L      O   O       WW WW  O   O  R  R   L      D   D     │
│  H   H  EEEEE  LLLLL  LLLLL   OOO         W W    OOO   R   R  LLLLL  DDDD      │
│                                                                                  │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

| Region | Component | Description |
|--------|-----------|-------------|
| Top margin | Empty line | 1 blank line before art for visual breathing room |
| Art block | `AsciiArtRenderer` | 5 rows of block letters composing "HELLO WORLD" |
| Word gap | Whitespace column | 4-space gap between "HELLO" and "WORLD" — uncolored |
| Bottom margin | Empty line | 1 blank line after art |

**Total output height**: 7 lines (1 margin + 5 art rows + 1 margin).

**Total output width**: ≤ 76 characters of art content (fits 80-column terminal with 2-char side margins).

### ASCII Art Letter Specifications

Each letter is rendered as a **5-line-tall × variable-width** block using only printable ASCII characters (letters and spaces). No Unicode box-drawing or special characters.

| Letter | Width (cols) | Glyph Design (5 rows) |
|--------|-------------|----------------------|
| H | 5 | `H   H` / `H   H` / `HHHHH` / `H   H` / `H   H` |
| E | 5 | `EEEEE` / `E    ` / `EEEE ` / `E    ` / `EEEEE` |
| L | 5 | `L    ` / `L    ` / `L    ` / `L    ` / `LLLLL` |
| O | 5 | ` OOO ` / `O   O` / `O   O` / `O   O` / ` OOO ` |
| W | 5 | `W   W` / `W   W` / `W W W` / `WW WW` / ` W W ` |
| R | 5 | `RRRR ` / `R   R` / `RRRR ` / `R  R ` / `R   R` |
| D | 5 | `DDDD ` / `D   D` / `D   D` / `D   D` / `DDDD ` |
| (space) | 4 | `    ` / `    ` / `    ` / `    ` / `    ` |

**Inter-letter spacing**: 2 spaces between adjacent letters within a word.

**Inter-word spacing**: 4 spaces (the space character glyph) between "HELLO" and "WORLD".

### New Components

These are logical module names — not UI components. They define the output-generation units the Architect will structure.

| Component | Inputs | Design Tokens | Description |
|-----------|--------|--------------|-------------|
| `AsciiArtRenderer` | Letter string (e.g., `"HELLO WORLD"`) | `$letter-height`, `$letter-spacing`, `$word-spacing` | Composes individual letter glyphs into a multi-line ASCII art string. Returns an array of 5 strings (one per row). |
| `RainbowColorizer` | Array of row strings, color map | `$rainbow-*` color tokens | Applies per-letter-column ANSI color codes to each row. Skips coloring the space gap. Returns colored string array. |
| `AnimationController` | Colored art rows, delay config | `$animation-delay`, `$animation-total-max` | Phase 2 only. Reveals letters one at a time with timed delays. Manages cursor visibility. |
| `TerminalCapabilityDetector` | — | — | Detects terminal color support level via chalk. Returns capability level: `truecolor`, `256`, `16`, or `none`. |

## Design Tokens Used

### Rainbow Color Palette

These are the per-letter colors applied across the 11-character "HELLO WORLD" string. Each token maps to a specific position in the rainbow cycle.

| Token | Hex Value | RGB | Letter Position | Fallback (16-color) |
|-------|-----------|-----|----------------|---------------------|
| `$rainbow-red` | `#FF0000` | `rgb(255, 0, 0)` | 1 (H), 11 (D) | ANSI red (31) |
| `$rainbow-orange` | `#FF7F00` | `rgb(255, 127, 0)` | 2 (E) | ANSI yellow (33) |
| `$rainbow-yellow` | `#FFFF00` | `rgb(255, 255, 0)` | 3 (L) | ANSI yellow (33) |
| `$rainbow-green` | `#00FF00` | `rgb(0, 255, 0)` | 4 (L) | ANSI green (32) |
| `$rainbow-cyan` | `#00FFFF` | `rgb(0, 255, 255)` | 5 (O) | ANSI cyan (36) |
| `$rainbow-blue` | `#0000FF` | `rgb(0, 0, 255)` | 7 (W) | ANSI blue (34) |
| `$rainbow-indigo` | `#4B0082` | `rgb(75, 0, 130)` | 8 (O) | ANSI magenta (35) |
| `$rainbow-violet` | `#8B00FF` | `rgb(139, 0, 255)` | 9 (R) | ANSI magenta (35) |
| `$rainbow-magenta` | `#FF00FF` | `rgb(255, 0, 255)` | 10 (L) | ANSI magenta (35) |

**Note**: Position 6 (space between words) receives no color.

### Layout Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `$letter-height` | `5` (rows) | Number of text rows per ASCII art letter |
| `$letter-spacing` | `2` (columns) | Space characters between adjacent letters in a word |
| `$word-spacing` | `4` (columns) | Space characters between "HELLO" and "WORLD" |
| `$top-margin` | `1` (row) | Blank lines above ASCII art |
| `$bottom-margin` | `1` (row) | Blank lines below ASCII art |

### Animation Tokens (Phase 2)

| Token | Value | Usage |
|-------|-------|-------|
| `$animation-delay` | `150` (ms) | Delay between each letter reveal |
| `$animation-space-delay` | `0` (ms) | No delay for the space gap — it appears instantly |
| `$animation-total-max` | `5000` (ms) | Maximum total animation duration (NFR-2 safety bound) |

## States & Interactions

| Component | State | Visual Treatment |
|-----------|-------|-----------------|
| `AsciiArtRenderer` | Default | All 5 rows of "HELLO WORLD" rendered with letter characters and whitespace |
| `AsciiArtRenderer` | Empty input | Should not occur — input is hardcoded. No defensive rendering needed. |
| `RainbowColorizer` | Truecolor mode | Each letter column wrapped in `\x1b[38;2;R;G;Bm...\x1b[0m` using exact hex values from the rainbow palette |
| `RainbowColorizer` | 256-color mode | chalk auto-downgrades RGB values to closest 256-color palette entry |
| `RainbowColorizer` | 16-color mode | Each letter column uses the 16-color ANSI fallback from the token table (e.g., orange → yellow, indigo → magenta) |
| `RainbowColorizer` | No color mode | No ANSI codes applied. Output is plain monochrome ASCII art. Triggered by `NO_COLOR` env, `TERM=dumb`, or chalk detecting no support. |
| `AnimationController` | Idle | No output yet. Cursor hidden (`\x1b[?25l`). |
| `AnimationController` | Revealing | Letters appear left-to-right, one at a time. Each new letter is drawn across all 5 rows simultaneously (column reveal, not row reveal). Cursor remains hidden. |
| `AnimationController` | Space gap | The 4-column gap is drawn instantly with no delay. |
| `AnimationController` | Complete | All letters visible. Cursor restored (`\x1b[?25h`). Trailing newline printed. |
| `AnimationController` | No color fallback | Animation still runs (letters still reveal one at a time) but without ANSI color codes. |

### Animation Sequence Detail (Phase 2)

The reveal proceeds column-by-column through the composed art:

```
Frame 0:   (blank — cursor hidden)
Frame 1:   H appears (red) across all 5 rows           +150ms
Frame 2:   E appears (orange) next to H                 +150ms
Frame 3:   L appears (yellow) next to E                 +150ms
Frame 4:   L appears (green)                            +150ms
Frame 5:   O appears (cyan)                             +150ms
Frame 6:   [space gap] — no delay                       +0ms
Frame 7:   W appears (blue)                             +150ms
Frame 8:   O appears (indigo)                           +150ms
Frame 9:   R appears (violet)                           +150ms
Frame 10:  L appears (magenta)                          +150ms
Frame 11:  D appears (red-loop)                         +150ms
Frame 12:  Cursor restored, newline printed              immediate
```

Total animation: ~1,500 ms (10 letter delays × 150 ms). Well within `$animation-total-max` of 5,000 ms.

### Rendering Technique (Phase 2)

Each frame redraws all 5 rows from the beginning. The approach:
1. Move cursor to the start of the art block (cursor home to art origin)
2. Write all 5 rows with currently-visible letters
3. Flush stdout

This avoids screen-clear flicker — each frame overwrites the previous one in place.

## Accessibility

Since this is a CLI application, "accessibility" applies to terminal output usability and color independence.

| Requirement | Implementation |
|-------------|---------------|
| Color independence | ASCII art text is fully readable without any color — the letter shapes convey the message. Color is decorative enhancement, not information-bearing. |
| `NO_COLOR` compliance | Respect the `NO_COLOR` environment variable (no-color.org standard). When set, emit zero ANSI escape codes. |
| `TERM=dumb` handling | Detect `TERM=dumb` and suppress all ANSI codes (chalk handles this automatically). |
| Screen reader compatibility | Output is plain text characters — screen readers that read terminal output will encounter standard ASCII letters (H, E, L, etc.). No invisible characters or escape code pollution in no-color mode. |
| Contrast | Rainbow colors on the default terminal background (typically black or dark) all meet a minimum contrast ratio: red, orange, yellow, green, cyan, magenta, and violet on `#000000` background all exceed 4.5:1.¹ Indigo (`#4B0082`) and blue (`#0000FF`) are lower contrast — acceptable as decorative, since text is readable by letter shape alone. |
| Cursor restoration | Phase 2 animation hides the cursor. On completion AND on unexpected exit (`SIGINT`/`SIGTERM`), the cursor MUST be restored via `\x1b[?25h`. Register a signal handler to ensure this. |
| Non-interactive | The application produces output and exits. No keyboard input is required. No prompts, no blocking reads. |

¹ Contrast ratios against `#000000`: Red `#FF0000` = 5.25:1, Orange `#FF7F00` = 8.6:1, Yellow `#FFFF00` = 19.56:1, Green `#00FF00` = 15.3:1, Cyan `#00FFFF` = 16.7:1, Blue `#0000FF` = 2.44:1 (decorative), Indigo `#4B0082` = 1.35:1 (decorative), Violet `#8B00FF` = 3.12:1 (decorative), Magenta `#FF00FF` = 6.7:1.

## Responsive Behavior

"Responsive" for a CLI means adapting to terminal width.

| Terminal Width | Behavior |
|---------------|----------|
| ≥ 80 columns | Full ASCII art output as designed. Art is left-aligned with the natural indentation from letter composition. |
| < 80 columns | No dynamic reflow. Art may wrap, but this is acceptable for an 80-column-targeted design. No truncation or reformatting is performed. |
| Piped output (`stdout` is not a TTY) | Phase 1: Output as normal (static art, colors may be suppressed by chalk). Phase 2: Skip animation, fall back to static output. Animation requires a TTY for cursor manipulation. |

**Design decision**: The art is designed for 80-column terminals. No dynamic line-wrapping or width detection is implemented. This keeps the design simple and aligns with the project's non-goals (no configuration, no complexity beyond the core experience).

## Design System Additions

All design tokens listed above are new — this is a standalone CLI project with no pre-existing design system. These tokens exist as named constants in the codebase, not as CSS custom properties or theme files.

| Type | Name | Value | Rationale |
|------|------|-------|-----------|
| Color | `$rainbow-red` | `#FF0000` | Standard rainbow spectrum starting color |
| Color | `$rainbow-orange` | `#FF7F00` | Orange — requires RGB/256 color support |
| Color | `$rainbow-yellow` | `#FFFF00` | Yellow in rainbow sequence |
| Color | `$rainbow-green` | `#00FF00` | Green in rainbow sequence |
| Color | `$rainbow-cyan` | `#00FFFF` | Cyan in rainbow sequence |
| Color | `$rainbow-blue` | `#0000FF` | Blue in rainbow sequence |
| Color | `$rainbow-indigo` | `#4B0082` | Indigo — requires RGB/256 color support |
| Color | `$rainbow-violet` | `#8B00FF` | Violet — requires RGB/256 color support |
| Color | `$rainbow-magenta` | `#FF00FF` | Magenta — completes the spectrum before loop |
| Layout | `$letter-height` | `5` | Conservative height — readable without dominating terminal |
| Layout | `$letter-spacing` | `2` | Prevents letters from merging while keeping art compact |
| Layout | `$word-spacing` | `4` | Clear visual separation between words |
| Timing | `$animation-delay` | `150ms` | Perceptible reveal without feeling sluggish |
| Timing | `$animation-space-delay` | `0ms` | Space gap should not introduce a visible pause |
