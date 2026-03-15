# Rainbow Hello

Displays HELLO WORLD in large rainbow-colored ASCII art in your terminal.

## Preview

```
 █   █ █████ █     █     █████   █   █ █████ ████  █     ████
 █   █ █     █     █     █   █   █   █ █   █ █   █ █     █   █
 █████ ████  █     █     █   █   █ █ █ █   █ ████  █     █   █
 █   █ █     █     █     █   █   █████ █   █ █  █  █     █   █
 █   █ █████ █████ █████ █████    █ █  █████ █   █ █████ ████
```

When run in a color-capable terminal, each letter is displayed in a different rainbow color.

## Requirements

- Node.js 18+ (LTS recommended)
- A terminal with at least **80 columns** width (standard default)
- Unicode support for block characters (`█`)

## Installation

```bash
cd sample-apps/rainbow-hello
npm install
```

## Usage

### Static Display

```bash
npm start
```

Prints the full HELLO WORLD rainbow art instantly and exits.

### Animated Reveal

```bash
npm run animate
```

Reveals letters one at a time from left to right, then exits. Press Ctrl+C to stop early.

### Run Tests

```bash
npm test
```

Runs the full test suite using the Node.js built-in test runner.

## Color Support

- Color is enabled by default when running in a color-capable terminal
- Respects the `NO_COLOR` environment variable — set `NO_COLOR=1` to disable color output
- When piped or redirected, color is automatically disabled (plain ASCII art is output)

## Dependencies

- **[chalk](https://github.com/chalk/chalk)** (v5.x) — Terminal string styling with RGB color support
