import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runAdapterPlugin } from './run-plugin.js';
import { adapter as claudeAdapter } from './claude/adapter.js';
import { adapter as copilotCliAdapter } from './copilot-cli/adapter.js';

test('emits plugin layout for claude under expected output path', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-claude-'));
  const canonical = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-can-'));
  // Minimal canonical fixture: one plugin-source skill
  const skillDir = path.join(canonical, 'marketplace', 'plugins', 'rad-orchestration', 'skills', 'ui-start');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: ui-start\ndescription: x\n---\nbody\n');
  const hooksDir = path.join(canonical, 'marketplace', 'plugins', 'rad-orchestration', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(path.join(hooksDir, 'hooks.json'), JSON.stringify({ hooks: { SessionStart: [] } }));
  fs.writeFileSync(path.join(hooksDir, 'session-start.sh'), '#!/bin/sh\nexit 0\n');
  // Plugin manifest source
  const pluginCpDir = path.join(canonical, 'marketplace', 'plugins', 'rad-orchestration', '.claude-plugin');
  fs.mkdirSync(pluginCpDir, { recursive: true });
  fs.writeFileSync(path.join(pluginCpDir, 'plugin.json'), JSON.stringify({
    name: 'rad-orchestration', version: '1.0.0', description: 'x',
  }));

  await runAdapterPlugin(claudeAdapter, {
    canonicalRoot: canonical,
    outputRoot: tmp,
    version: '1.1.0',
  });

  const out = path.join(tmp, 'cli', 'dist', 'marketplaces', 'claude', 'plugins', 'rad-orchestration');
  assert.ok(fs.existsSync(path.join(out, '.claude-plugin', 'plugin.json')));
  assert.ok(fs.existsSync(path.join(out, 'skills', 'ui-start', 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(out, 'hooks', 'hooks.json')));
  assert.ok(fs.existsSync(path.join(out, 'hooks', 'session-start.sh')));
  // Plugin.json version is overwritten with the version arg
  const p = JSON.parse(fs.readFileSync(path.join(out, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.equal(p.version, '1.1.0');
  // Skills array populated
  assert.deepEqual(p.skills, ['./skills']);
});

test('copilot-cli emits to its own gitignored marketplaces folder', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-copilot-'));
  const canonical = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-can-'));
  // empty canonical sources are tolerated (skills/hooks dirs absent)
  fs.mkdirSync(path.join(canonical, 'marketplace', 'plugins', 'rad-orchestration', '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(canonical, 'marketplace', 'plugins', 'rad-orchestration', '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'rad-orchestration', version: '0.0.0' }),
  );
  await runAdapterPlugin(copilotCliAdapter, { canonicalRoot: canonical, outputRoot: tmp, version: '1.1.0' });
  const out = path.join(tmp, 'cli', 'dist', 'marketplaces', 'copilot-cli', 'plugins', 'rad-orchestration');
  assert.ok(fs.existsSync(path.join(out, '.claude-plugin', 'plugin.json')));
});

test('idempotent: second run produces byte-identical output', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-idem-'));
  const canonical = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-can-'));
  fs.mkdirSync(path.join(canonical, 'marketplace', 'plugins', 'rad-orchestration', '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(canonical, 'marketplace', 'plugins', 'rad-orchestration', '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'rad-orchestration', version: '0.0.0' }),
  );
  await runAdapterPlugin(claudeAdapter, { canonicalRoot: canonical, outputRoot: tmp, version: '1.1.0' });
  const out = path.join(tmp, 'cli', 'dist', 'marketplaces', 'claude', 'plugins', 'rad-orchestration');
  const p1 = fs.readFileSync(path.join(out, '.claude-plugin', 'plugin.json'));
  await runAdapterPlugin(claudeAdapter, { canonicalRoot: canonical, outputRoot: tmp, version: '1.1.0' });
  const p2 = fs.readFileSync(path.join(out, '.claude-plugin', 'plugin.json'));
  assert.deepEqual(p1, p2);
});
