import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { emitUiBundle } from '../emit-ui-bundle.js';

// Driven via a synthetic build runner injected as a parameter — we don't
// execute real Next.js inside unit tests. The helper's responsibility under
// test is the orchestration: invoke the build runner, copy standalone+static+public,
// then clean up .next/. Real Next.js invocation is exercised by P05's
// build-orchestrator smoke test.
test('emitUiBundle copies standalone, static, public and removes .next after build', async () => {
  const tmpRoot = fs.mkdtempSync(join(os.tmpdir(), 'emit-ui-'));
  try {
    const ui = join(tmpRoot, 'ui');
    fs.mkdirSync(ui, { recursive: true });
    // Synthetic .next/ tree that the fake runner pretends to populate.
    const runner = async () => {
      fs.mkdirSync(join(ui, '.next/standalone'), { recursive: true });
      fs.writeFileSync(join(ui, '.next/standalone/server.js'), '// server\n');
      fs.mkdirSync(join(ui, '.next/static/chunks'), { recursive: true });
      fs.writeFileSync(join(ui, '.next/static/chunks/main.js'), '// main\n');
      fs.mkdirSync(join(ui, 'public'), { recursive: true });
      fs.writeFileSync(join(ui, 'public/logo.svg'), '<svg/>');
    };
    const target = join(tmpRoot, 'out-ui');
    await emitUiBundle({ source: ui, target, runner });
    assert.ok(fs.existsSync(join(target, 'server.js')), 'standalone copied');
    assert.ok(fs.existsSync(join(target, '.next/static/chunks/main.js')), 'static copied');
    assert.ok(fs.existsSync(join(target, 'public/logo.svg')), 'public/ copied');
    assert.ok(!fs.existsSync(join(ui, '.next')), '.next/ removed after build (NFR-4)');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
