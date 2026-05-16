#!/usr/bin/env node
// CLI entry. Default verb is `build`; optional `--harness=<name>` filter.
// Detailed argv parsing and exit-code handling land in P04-T02.

import { build } from './index.js';

const args = process.argv.slice(2);
const flag = args.find((a) => a.startsWith('--harness='));
const harness = flag ? flag.slice('--harness='.length) : undefined;

build({ harness }).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
