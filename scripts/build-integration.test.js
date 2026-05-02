// scripts/build-integration.test.js — End-to-end: every adapter produces a
// well-formed manifest stream that MULTI-HARNESS-2 can reason over (FR-18).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';
import { discoverAdapters } from '../adapters/discover.js';
import { runAdapter } from '../adapters/run.js';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

function makeCanonical() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-'));
  fs.mkdirSync(path.join(dir, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'skills', 'rad-demo'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'agents', 'sample.md'),
    '---\nname: sample\ndescription: d\nmodel: opus\ntools: Read, Bash\n---\nbody\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(dir, 'skills', 'rad-demo', 'SKILL.md'),
    '---\nname: rad-demo\ndescription: d\n---\nbody\n',
    'utf8',
  );
  return dir;
}

test('every discovered adapter produces a well-formed manifest', async () => {
  const adapters = await discoverAdapters(path.join(repoRoot, 'adapters'));
  assert.ok(adapters.length >= 3, 'at least three adapters expected');
  const canonical = makeCanonical();

  for (const adapter of adapters) {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), `out-${adapter.name}-`));
    await runAdapter(adapter, { canonicalRoot: canonical, outputRoot: out, version: '0.0.0-test' });
    // manifest.json lives at <outputRoot>/<adapter.name>/manifest.json (keyed on
    // adapter.name so that adapters sharing a targetDir, e.g. copilot-vscode and
    // copilot-cli both targeting .github, each get a unique manifest path).
    const manifestPath = path.join(out, adapter.name, 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), `${adapter.name} must emit manifest.json`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(manifest.harness, adapter.name);
    assert.strictEqual(manifest.version, '0.0.0-test');
    assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0);
    for (const f of manifest.files) {
      assert.ok(typeof f.bundlePath === 'string' && f.bundlePath.length > 0);
      assert.ok(typeof f.sourcePath === 'string' && f.sourcePath.length > 0);
      assert.strictEqual(f.ownership, 'orchestration-system');
      assert.strictEqual(f.version, '0.0.0-test');
      assert.strictEqual(f.harness, adapter.name);
    }
    fs.rmSync(out, { recursive: true, force: true });
  }
  fs.rmSync(canonical, { recursive: true, force: true });
});
