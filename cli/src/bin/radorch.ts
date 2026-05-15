#!/usr/bin/env node
import { buildProgram } from '../cli.js';
import { getCliVersion } from '../lib/package-version.js';
const program = buildProgram(getCliVersion());
program.parseAsync(process.argv).catch((err: unknown) => {
  // Top-level guard — any error here is a bug, not user input. Print to stderr; exit 2.
  process.stderr.write((err instanceof Error ? err.message : String(err)) + '\n');
  process.exit(2);
});
