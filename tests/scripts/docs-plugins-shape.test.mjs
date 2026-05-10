import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('docs/plugins.md exists with the documented section structure', () => {
  const text = fs.readFileSync(path.join(repoRoot, 'docs', 'plugins.md'), 'utf8');
  for (const heading of ['## Install', '## What ships', '## State location', '## Slash command surface', '## Updates and uninstall', '## Per-harness support']) {
    assert.match(text, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing section: ${heading}`);
  }
  // No implementation leaks
  assert.doesNotMatch(text, /CLAUDE_PLUGIN_ROOT/);
  assert.doesNotMatch(text, /esbuild/);
  assert.doesNotMatch(text, /marketplace\.json/);
});

test('README.md documentation table links to docs/plugins.md', () => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  assert.match(readme, /\[plugins\.md\]\(docs\/plugins\.md\)|docs\/plugins\.md/);
});
