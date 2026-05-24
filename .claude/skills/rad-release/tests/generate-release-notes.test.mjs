import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { generateReleaseNotes } from '../scripts/generate-release-notes.mjs';

test('generateReleaseNotes writes RELEASE-NOTES-v{X}.md to the repo root (DD-3)', async () => {
  const written = {};
  await generateReleaseNotes({
    repoRoot: '/repo',
    version: '1.0.0-alpha.10',
    sections: { whatsNew: '- A', whatsFixed: '- B', changes: '- C' },
    writeFile: async (p, body) => { written.path = p; written.body = body; },
  });
  assert.strictEqual(written.path, path.join('/repo', 'RELEASE-NOTES-v1.0.0-alpha.10.md'));
  assert.match(written.body, /^## What's New/m);
  assert.match(written.body, /^## What's Fixed/m);
  assert.match(written.body, /^## Changes/m);
  // DD-3 Package table lists each shipped artifact
  assert.match(written.body, /^## Package/m);
  assert.match(written.body, /rad-orc-plugins.*v1\.0\.0-alpha\.10/);
  assert.match(written.body, /npmjs\.com\/package\/rad-orc/);
});

test('generateReleaseNotes omits sections that have no content (DD-3)', async () => {
  const written = {};
  await generateReleaseNotes({
    repoRoot: '/repo',
    version: '1.0.0-alpha.10',
    sections: { whatsNew: '- A', whatsFixed: '', changes: '' },
    writeFile: async (p, body) => { written.body = body; },
  });
  assert.match(written.body, /## What's New/);
  assert.doesNotMatch(written.body, /## What's Fixed/);
  assert.doesNotMatch(written.body, /## Changes/);
  assert.match(written.body, /## Package/);
});
