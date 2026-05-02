---
project: "RAINBOW-HELLO-QUICK"
author: "brainstormer-agent"
created: "2026-05-02"
---

# RAINBOW-HELLO-QUICK — Brainstorming

## Problem Space

Same fun shape as RAINBOW-HELLO — a Node.js CLI that prints "HELLO WORLD" in large rainbow ASCII letters — sized so the Extra Large-recommended quick planner produces a multi-task, multi-phase plan. The point of this fixture is to exercise the quick pipeline end-to-end through plan approval, not to deliver a different feature.

## Validated Ideas

### Idea 1: Rainbow ASCII "HELLO WORLD"
Same as RAINBOW-HELLO. Hardcoded ASCII art string + ANSI rainbow per letter, single invocation, no flags.

### Idea 2: Character-by-Character Reveal
Reveal letters one at a time with a 100ms delay; cycle each letter through the rainbow as it appears.

## Scope Boundaries

### In Scope
- Node.js CLI, no framework
- Hardcoded ASCII letters + ANSI rainbow
- Two visible behaviors: instant render (Idea 1) and character-by-character reveal (Idea 2), exposed via a single `--reveal` flag
- Unit tests for color-code emission and reveal timing
- README with usage + ASCII showcase

### Out of Scope
- Other flags (--word, --style)
- Configuration files
- Web port

## Key Constraints
- Build target: small enough for an Extra Large quick plan to ship in 2–4 tasks across 2 phases.
- Minimal dependencies — Node builtins; chalk optional.

## Summary
A two-phase quick-mode rainbow HELLO WORLD CLI: instant render in phase 1, reveal animation in phase 2. Sized so the Extra Large planner emits a multi-phase plan that can exercise the quick pipeline end-to-end.
