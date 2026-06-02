import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const builders = [
  'harness-installers/standard/build-scripts/build.js',
  'harness-installers/claude-plugin/build-scripts/build.js',
  'harness-installers/copilot-cli-plugin/build-scripts/build.js',
  'harness-installers/copilot-vscode-plugin/build-scripts/build.js',
];

test('no builder retains a per-package bootstrap-deps loop', () => {
  for (const rel of builders) {
    const src = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    assert.ok(!src.includes("step('bootstrap-deps'"), `${rel} still has bootstrap-deps step`);
    assert.ok(!/BOOTSTRAP_TARGETS/.test(src), `${rel} still has BOOTSTRAP_TARGETS`);
  }
});
