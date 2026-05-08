#!/usr/bin/env node
import { buildProgram } from '../cli.js';
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
const pkg = require_('../../package.json') as { version: string };
const program = buildProgram(pkg.version);
program.parseAsync(process.argv).catch((err: unknown) => {
  // Top-level guard — any error here is a bug, not user input. Print to stderr; exit 2.
  process.stderr.write((err instanceof Error ? err.message : String(err)) + '\n');
  process.exit(2);
});
