import { renderRainbowHello } from './renderer.js';
import { animateReveal } from './animator.js';

/**
 * CLI entry point. Determines the execution mode and runs the appropriate function.
 *
 * Static mode (default):  Calls renderRainbowHello(), writes result to stdout, exits 0.
 * Animated mode (--animate): Calls animateReveal(), awaits completion, exits 0.
 *
 * On unexpected error: prints message to stderr, exits 1.
 *
 * Error format: "Error: Unable to render output. {reason}"
 */
async function main() {
  const animate = process.argv.includes('--animate');

  try {
    if (animate) {
      await animateReveal();
      process.exit(0);
    } else {
      const output = renderRainbowHello();
      console.log(output);
      process.exit(0);
    }
  } catch (err) {
    console.error(`Error: Unable to render output. ${err.message}`);
    process.exit(1);
  }
}

main();
