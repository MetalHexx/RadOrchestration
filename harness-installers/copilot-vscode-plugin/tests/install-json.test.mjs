import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { readInstallJson, writeInstallJson, loadRegistry, isCurrentShape, buildCopilotVscodePluginEntry } from '../lib/install/install-json.js';

test('writeInstallJson uses tmp+rename atomicity and strips state_schema_version', () => {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'ij-vsc-'));
  try {
    const f = join(dir, 'install.json');
    writeInstallJson(f, { harnesses: { 'copilot-vscode-plugin': { version: '1.0.0' } } });
    assert.deepStrictEqual(fs.readdirSync(dir).filter((n) => n.includes('.tmp')), []);
    const raw = fs.readFileSync(f, 'utf8');
    assert.ok(!raw.includes('state_schema_version'), 'new writes carry no version field');
    const read = readInstallJson(f);
    assert.strictEqual(read.harnesses['copilot-vscode-plugin'].version, '1.0.0');
    assert.ok(isCurrentShape(read), 'shape identified by presence of harnesses');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('loadRegistry returns empty harnesses on missing file, malformed JSON, or non-conforming shape', () => {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'ij-vsc-lr-'));
  try {
    assert.deepStrictEqual(loadRegistry(join(dir, 'absent.json')), { harnesses: {} });
    fs.writeFileSync(join(dir, 'bad.json'), 'not json');
    assert.deepStrictEqual(loadRegistry(join(dir, 'bad.json')), { harnesses: {} });
    fs.writeFileSync(join(dir, 'flat.json'), JSON.stringify({ state_schema_version: 'v5', package_version: '0.9.0' }));
    assert.deepStrictEqual(loadRegistry(join(dir, 'flat.json')), { harnesses: {} });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('buildCopilotVscodePluginEntry stamps channel = copilot-vscode-plugin and version fields', () => {
  const e = buildCopilotVscodePluginEntry('1.0.0');
  assert.strictEqual(e.version, '1.0.0');
  assert.strictEqual(e.channel, 'copilot-vscode-plugin');
  assert.strictEqual(e.last_writer_version, '1.0.0');
  assert.match(e.installed_at, /^\d{4}-\d{2}-\d{2}T/);
});
