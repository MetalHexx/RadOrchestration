---
project: "RAINBOW-HELLO"
author: "research-agent"
created: "2026-03-15"
---

# RAINBOW-HELLO — Research Findings

## Research Scope

Investigated the existing workspace structure, Node.js patterns, and external libraries relevant to building a CLI app that displays "HELLO WORLD" in large ASCII art with rainbow ANSI colors. Focused on ASCII art generation approaches, terminal color libraries, testing conventions, and the target `sample-apps/rainbow-hello/` directory.

## Codebase Analysis

### Relevant Existing Code

| File/Module | Path | Relevance |
|-------------|------|-----------|
| Target directory | `sample-apps/rainbow-hello/` | **Empty** — no existing code. Clean slate for the project. |
| Orchestration scripts | `.github/orchestration/scripts/` | Establishes workspace Node.js patterns: CommonJS modules, `node:test` runner, `node:assert` for assertions |
| Path resolver test | `ui/lib/path-resolver.test.mjs` | ESM test example using `node:assert` — shows workspace also uses ESM in some areas |
| UI package.json | `ui/package.json` | Reference for package.json structure in this workspace. Uses Next.js 14, TypeScript, ESM. Not directly relevant but shows workspace conventions. |
| Orchestration tests | `.github/orchestration/scripts/tests/*.test.js` | Pattern: `node:test` with `describe`/`it` blocks, `node:assert` or `node:assert/strict`. No external test frameworks. |

### Existing Patterns

- **Testing framework**: `node:test` (Node.js built-in test runner) with `node:assert` — used consistently across orchestration scripts. No Jest, Vitest, or Mocha in use.
- **Module system**: Orchestration scripts use CommonJS (`require`). UI uses ESM (`import`). For a standalone CLI app, ESM with `"type": "module"` in package.json is the modern approach.
- **Minimal dependencies**: Workspace philosophy favors Node.js builtins over external packages. The README states "no npm install" for the core system.
- **File naming**: Project files use `SCREAMING-CASE` with project prefix. Source code files use lowercase with hyphens.
- **Git conventions**: Single branch strategy, `[orch]` commit prefix, auto-commit enabled.

### Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Runtime | Node.js | 18+ LTS (assumed) | Brainstorming doc specifies modern LTS |
| Test runner | `node:test` | Built-in (Node 18+) | Workspace standard — no external test framework |
| Assertions | `node:assert` | Built-in | Used with `/strict` variant in some tests |
| Package manager | npm | Bundled with Node | Only package manager referenced in workspace |

## External Research

### ASCII Art Generation

| Approach | Details |
|----------|---------|
| **figlet** (npm) | v1.11.0, MIT, 2M weekly downloads. TypeScript built-in. Sync (`textSync`) and async (`text`) APIs. 700+ fonts included. **Caveat**: 18.8 MB unpacked (1,004 files — mostly font files). Overkill for a single "HELLO WORLD" string but produces professional-quality output. |
| **Hardcoded ASCII art** | Zero dependencies. Define letter shapes as string arrays and compose them. Full control over letter design. **Caveat**: Manual work to design each letter (H, E, L, O, W, R, D + space = 8 unique glyphs). Keeps the project size tiny. |
| **Hybrid approach** | Use figlet during development to generate the art, then hardcode the output as a constant. Gets professional fonts with zero runtime dependency. |

### Terminal Color Approaches

| Approach | Details |
|----------|---------|
| **chalk** (npm) | v5.6.2, MIT, 373M weekly downloads. Zero dependencies. ESM-only (v5+). Auto-detects terminal color support. Supports 16/256/16M colors. `chalk.rgb(r,g,b)` for precise rainbow colors. Cross-platform (handles Windows Terminal). **44.3 kB** unpacked. |
| **Raw ANSI escape codes** | Zero dependencies. `\x1b[31m` red, `\x1b[32m` green, etc. 16 basic colors or `\x1b[38;2;R;G;Bm` for RGB truecolor. **Caveat**: No auto-detection of terminal capabilities. May produce garbage output on terminals without color support. |
| **ansi-styles** (npm) | v6.2.3, MIT, 479M weekly downloads. Lower-level than chalk — provides open/close escape codes. 17.5 kB. Same maintainer as chalk. More manual than chalk but lighter-weight conceptually. |

### Rainbow Color Spectrum

For a rainbow cycle across 11 characters (H-E-L-L-O-[space]-W-O-R-L-D), a standard spectrum:

| Position | Color | Hex | ANSI 16-color |
|----------|-------|-----|---------------|
| 1 (H) | Red | `#FF0000` | `\x1b[31m` |
| 2 (E) | Orange | `#FF7F00` | Requires RGB/256 |
| 3 (L) | Yellow | `#FFFF00` | `\x1b[33m` |
| 4 (L) | Green | `#00FF00` | `\x1b[32m` |
| 5 (O) | Cyan | `#00FFFF` | `\x1b[36m` |
| 6 (space) | — | — | No color needed |
| 7 (W) | Blue | `#0000FF` | `\x1b[34m` |
| 8 (O) | Indigo | `#4B0082` | Requires RGB/256 |
| 9 (R) | Violet | `#8B00FF` | Requires RGB/256 |
| 10 (L) | Magenta | `#FF00FF` | `\x1b[35m` |
| 11 (D) | Red (loop) | `#FF0000` | `\x1b[31m` |

Orange, indigo, and violet require 256-color or truecolor mode — not available in basic 16-color terminals. chalk handles downsampling automatically; raw ANSI codes would need manual fallback.

### Animation / Reveal Effect (Phase 2)

| Approach | Details |
|----------|---------|
| **setTimeout / setInterval** | Standard Node.js timing. `process.stdout.write()` for non-newline output. Clear previous frame with `\x1b[2J` (clear screen) or `\r` + overwrite. |
| **Async iteration with delay** | `await new Promise(r => setTimeout(r, ms))` in a loop. Clean, readable, easy to test with mocked timers. |
| **chalk-animation** (npm) | Pre-built rainbow/pulse/neon animations. Depends on chalk. Could be a reference but likely overkill for a simple reveal. |
| **Raw cursor manipulation** | `\x1b[H` (cursor home), `\x1b[?25l` (hide cursor), `\x1b[?25h` (show cursor). Fine-grained control for character-by-character reveal. |

### Testing CLI Output

| Approach | Details |
|----------|---------|
| **Capture stdout** | Redirect `process.stdout.write` or `console.log` to a buffer. Assert output contains expected ANSI codes and ASCII art structure. Works with `node:test`. |
| **Strip ANSI + snapshot** | Use `strip-ansi` (npm) or regex `/\x1b\[[0-9;]*m/g` to strip color codes, then assert plain text matches expected ASCII art. |
| **Test functions, not output** | Export `generateArt()` and `colorize()` as pure functions. Test return values directly. `console.log` in the entrypoint is untested but trivial. |
| **node:test mock** | `mock.method(process.stdout, 'write')` to capture output. Built-in to `node:test` — no external mocking library needed. |

## Constraints Discovered

- **figlet is heavy**: 18.8 MB / 1,004 files for a "hello world" app. If dependency size matters, hardcoded art or the hybrid approach (generate once, embed) is preferable.
- **chalk v5 is ESM-only**: Requires `"type": "module"` in package.json or `.mjs` extension. This aligns with modern Node.js but means no `require('chalk')`.
- **Orange/indigo/violet need RGB colors**: A true rainbow (not just the 8 basic ANSI colors) needs 256-color or truecolor support. chalk handles this automatically; raw ANSI codes require `\x1b[38;2;R;G;Bm` which may not work on all terminals.
- **Windows Terminal support**: Modern Windows Terminal supports ANSI colors. Legacy `cmd.exe` has limited support. chalk auto-detects and downgrades gracefully. Brainstorming doc notes "assume Git Bash / WSL" is acceptable.
- **Node.js 18+ assumed**: `node:test` requires Node 18+. This is consistent with using modern LTS as specified in the brainstorming document.
- **Phasing requirement**: The user explicitly wants **at least 2 phases**: Phase 1 for core ASCII art + colors, Phase 2 for animation/reveal effect. The brainstorming doc's "Idea 2" (character-by-character rainbow reveal) maps directly to Phase 2.

## Recommendations

- **Use chalk for colors**: Cross-platform color support with auto-detection, zero dependencies, ESM-native. The 44 kB size is negligible. Raw ANSI codes save one dependency but lose auto-detection and graceful degradation — not worth it for this project.
- **Hardcode ASCII art (preferred) or use figlet**: For a fixed "HELLO WORLD" string, hardcoded art avoids the 18.8 MB figlet dependency. The hybrid approach (generate with figlet, embed result) is a good compromise if professional font quality is desired.
- **Use `node:test` + `node:assert`**: Matches workspace conventions. No external test framework needed. Test pure functions (`generateArt`, `colorize`) rather than capturing stdout.
- **Use ESM with `"type": "module"`**: Aligns with chalk v5 requirement and modern Node.js practices. The UI side of this workspace already uses ESM.
- **Structure as 2 phases minimum**: Phase 1 delivers the core (ASCII art + rainbow colors + static output + tests + README). Phase 2 adds the character-by-character reveal animation with timing control. This matches the brainstorming doc's Idea 1 vs Idea 2 split and the user's phasing requirement.
- **Keep dependencies minimal**: `chalk` is the only runtime dependency needed. `figlet` optional (development-time only if using hybrid approach). Testing uses Node.js builtins exclusively.
- **Project structure**: Flat layout under `sample-apps/rainbow-hello/` — `index.js` (entrypoint), `lib/` (art + color modules), `test/` (tests), `package.json`, `README.md`. No framework, no build step.
