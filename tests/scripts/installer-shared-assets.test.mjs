import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const installerSrc = path.join(repoRoot, 'installer', 'src');
const SHA256_RE = /^[a-f0-9]{64}$/;
const LEGACY_HARNESSES = ['claude', 'copilot-vscode', 'copilot-cli'];

test('shared bin radorch.mjs exists at installer/src/bin/', () => {
  assert.ok(fs.existsSync(path.join(installerSrc, 'bin', 'radorch.mjs')));
  const bytes = fs.statSync(path.join(installerSrc, 'bin', 'radorch.mjs')).size;
  assert.ok(bytes > 0, 'shared bin must not be a zero-byte sentinel');
});

test('shared UI standalone bundle exists at installer/src/ui/', () => {
  assert.ok(fs.existsSync(path.join(installerSrc, 'ui', 'server.js')) ||
            fs.existsSync(path.join(installerSrc, 'ui', '.next', 'server.js')),
            'expected Next.js standalone server entry under installer/src/ui/');
});

for (const harness of LEGACY_HARNESSES) {
  test(`installer/src/${harness}/manifests/v*.json lists bin/radorch.mjs and ui/** with sha256`, () => {
    const manifestsDir = path.join(installerSrc, harness, 'manifests');
    if (!fs.existsSync(manifestsDir)) return;
    const versionFiles = fs.readdirSync(manifestsDir).filter(f => /^v.*\.json$/.test(f));
    assert.ok(versionFiles.length > 0, `${harness} has no manifest files`);
    const m = JSON.parse(fs.readFileSync(path.join(manifestsDir, versionFiles[0]), 'utf8'));
    const binEntry = m.files.find(f => f.bundlePath === 'bin/radorch.mjs');
    assert.ok(binEntry, `${harness} manifest missing bin/radorch.mjs entry`);
    assert.match(binEntry.sha256, SHA256_RE);
    const uiEntries = m.files.filter(f => f.bundlePath.startsWith('ui/'));
    assert.ok(uiEntries.length > 0, `${harness} manifest missing ui/** entries`);
    for (const e of uiEntries) assert.match(e.sha256, SHA256_RE);
    const agentEntries = m.files.filter(f => f.bundlePath.startsWith('agents/'));
    const skillEntries = m.files.filter(f => f.bundlePath.startsWith('skills/'));
    assert.ok(agentEntries.length > 0 && skillEntries.length > 0, `${harness} missing harness-specific assets`);
  });
}
