// Canary protocol: this test was validated against greenfield/harness-adapters/engine/index.js
// by temporarily adding "// CANARY: claude" to index.js line 1 and confirming the audit failed
// with the expected error message, then removing the canary and confirming the audit returned to PASS.
// This validates that the audit has teeth and will catch accidental harness-name literals (NFR-2).
// Verification completed: FAIL → remove → PASS cycle confirmed as expected.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ENGINE_ROOT = resolve('greenfield/harness-adapters/engine');
const BANNED = ['claude', 'copilot-vscode', 'copilot-cli'];

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // Tests legitimately spell harness names in fixture strings — exclude them.
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(join(dir, entry.name), acc);
      continue;
    }
    if (/\.(js|mjs|cjs|json)$/.test(entry.name)) acc.push(join(dir, entry.name));
  }
  return acc;
}

test('no engine source file contains a harness-name string literal (NFR-2)', () => {
  for (const file of walk(ENGINE_ROOT)) {
    const text = readFileSync(file, 'utf8');
    for (const banned of BANNED) {
      assert.ok(!text.toLowerCase().includes(banned),
        `${file} contains banned harness name "${banned}" — engine must be harness-blind (NFR-2)`);
    }
  }
});
