import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emitHookBundle } from '../emit-hook-bundle.js';

test('copies session-preamble.mjs into the hook bundle output', async () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-src-'));
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-out-'));
  fs.writeFileSync(path.join(source, 'bootstrap.mjs'), '#!/usr/bin/env node\nprocess.exit(0);\n');
  fs.writeFileSync(path.join(source, 'session-preamble.mjs'), '#!/usr/bin/env node\nexport function buildHookOutput(){return{additionalContext:""}}\n');
  await emitHookBundle({ source, target });
  assert.ok(fs.existsSync(path.join(target, 'session-preamble.mjs')));
});
