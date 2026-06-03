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

test('build-lib-dist precedes emit-cli-bundle and emit-ui-bundle in every builder', () => {
  for (const rel of builders) {
    const src = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    const lib = src.indexOf("step('build-lib-dist'");
    const cli = src.indexOf("step('emit-cli-bundle'");
    const ui = src.indexOf("step('emit-ui-bundle'");
    assert.ok(lib !== -1, `${rel} missing build-lib-dist`);
    assert.ok(lib < cli, `${rel} build-lib-dist must precede emit-cli-bundle`);
    assert.ok(lib < ui, `${rel} build-lib-dist must precede emit-ui-bundle`);
  }
});
