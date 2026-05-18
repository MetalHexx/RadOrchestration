import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path, { join } from 'node:path';
import { readInstallJson, writeInstallJson, migrateInstallJson, isCurrentShape } from '../lib/install/install-json.js';
import { installManifestFiles } from '../lib/install/install-files.js';
import { removeManifestFiles } from '../lib/install/remove-files.js';

test('writeInstallJson uses tmp+rename atomicity and strips state_schema_version', () => {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'ij-cli-'));
  try {
    const f = join(dir, 'install.json');
    writeInstallJson(f, { harnesses: { 'copilot-cli-plugin': { version: '1.0.0' } } });
    assert.deepStrictEqual(fs.readdirSync(dir).filter((n) => n.includes('.tmp')), []);
    const raw = fs.readFileSync(f, 'utf8');
    assert.ok(!raw.includes('state_schema_version'), 'new writes carry no version field');
    const read = readInstallJson(f);
    assert.strictEqual(read.harnesses['copilot-cli-plugin'].version, '1.0.0');
    assert.ok(isCurrentShape(read), 'shape identified by presence of harnesses');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('migrateInstallJson lifts both legacy shapes into harnesses-keyed unversioned', () => {
  const flat = { state_schema_version: 'v5', package_version: '0.9.0', installed_at: '2026-01-01T00:00:00Z' };
  const liftedFlat = migrateInstallJson(flat, 'copilot-cli-plugin');
  assert.ok(!('state_schema_version' in liftedFlat));
  assert.strictEqual(liftedFlat.harnesses['copilot-cli-plugin'].version, '0.9.0');

  const keyed = { state_schema_version: 'v6', harnesses: { 'copilot-cli-plugin': { version: '1.0.0', channel: 'copilot-cli-plugin', installed_at: 'x', last_writer_version: '1.0.0' } } };
  const liftedKeyed = migrateInstallJson(keyed, 'copilot-cli-plugin');
  assert.ok(!('state_schema_version' in liftedKeyed));
  assert.strictEqual(liftedKeyed.harnesses['copilot-cli-plugin'].version, '1.0.0');
});

test('installManifestFiles rejects a manifest entry whose expanded destinationPath escapes ~/.radorch/ via .. traversal (NFR-1, AD-2)', () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'esc-ij-'));
  const pluginRoot = fs.mkdtempSync(join(os.tmpdir(), 'esc-pr-'));
  try {
    fs.writeFileSync(join(pluginRoot, 'evil.txt'), 'should never be written outside radHome');
    const manifest = {
      version: '1.0.0',
      channel: 'copilot-cli-plugin',
      files: [
        { destinationPath: '${RAD_HOME}/../../etc/escape-target', sourcePath: 'evil.txt', ownership: 'installer-owned' },
      ],
    };
    assert.throws(() => installManifestFiles(manifest, pluginRoot, { radHome }),
      /escape|outside|\.\./i,
      'must reject path-traversal destination');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('removeManifestFiles skips (does not rmSync) a manifest entry whose expanded destinationPath escapes ~/.radorch/ (NFR-1, AD-11)', () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'esc-rj-'));
  const outsideDir = fs.mkdtempSync(join(os.tmpdir(), 'outside-rj-'));
  const sentinel = join(outsideDir, 'must-survive.txt');
  fs.writeFileSync(sentinel, 'must not be deleted');
  try {
    // Manifest entry's expanded path resolves to a sibling outside ~/.radorch/.
    // We construct destinationPath that, after ${RAD_HOME} substitution and
    // path.resolve, lands at `sentinel` (which is outside radHome).
    const relativeFromRad = path.relative(radHome, sentinel).split(path.sep).join('/');
    const manifest = {
      version: '1.0.0',
      channel: 'copilot-cli-plugin',
      files: [
        { destinationPath: '${RAD_HOME}/' + relativeFromRad, sourcePath: 'irrelevant', ownership: 'installer-owned' },
      ],
    };
    removeManifestFiles(manifest, { radHome });
    assert.ok(fs.existsSync(sentinel), 'sentinel outside ~/.radorch/ must survive');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});
