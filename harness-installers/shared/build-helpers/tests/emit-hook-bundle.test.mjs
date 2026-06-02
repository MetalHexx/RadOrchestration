import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emitHookBundle } from '../emit-hook-bundle.js';

test('stages session-preamble.mjs from sharedHooksDir, not the plugin source tree (AD-8)', async () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-src-'));
  const sharedHooksDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-shared-'));
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-out-'));
  fs.writeFileSync(path.join(source, 'bootstrap.mjs'), '#!/usr/bin/env node\nprocess.exit(0);\n');
  // The plugin `source` tree intentionally does NOT carry session-preamble.mjs.
  const sharedContents = '#!/usr/bin/env node\n// canonical shared shim\nexport function buildHookOutput(){return{additionalContext:""}}\n';
  fs.writeFileSync(path.join(sharedHooksDir, 'session-preamble.mjs'), sharedContents);
  await emitHookBundle({ source, target, sharedHooksDir });
  const staged = path.join(target, 'session-preamble.mjs');
  assert.ok(fs.existsSync(staged), 'session-preamble.mjs staged into output');
  assert.strictEqual(fs.readFileSync(staged, 'utf8'), sharedContents,
    'staged shim matches the sharedHooksDir copy, proving it came from the shared location');
});
