import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mergePreambleHook, removePreambleHook } from '../../lib/install/claude-hook-settings.js';

function tmpSettings(obj) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-'));
  const file = path.join(dir, 'settings.json');
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
  return file;
}

test('merges a marked SessionStart hook while preserving unrelated settings', () => {
  const file = tmpSettings({ theme: 'dark', hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'pre-existing' }] }] } });
  mergePreambleHook({ settingsPath: file, hookCommand: 'node preamble' });
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(s.theme, 'dark');
  assert.equal(s.hooks.SessionStart.length, 2);
  assert.ok(JSON.stringify(s.hooks.SessionStart).includes('rad-orc-preamble'));
  assert.ok(JSON.stringify(s.hooks.SessionStart).includes('pre-existing'));
});

test('merge is idempotent — re-running adds no duplicate marked entry', () => {
  const file = tmpSettings({});
  mergePreambleHook({ settingsPath: file, hookCommand: 'node preamble' });
  mergePreambleHook({ settingsPath: file, hookCommand: 'node preamble' });
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  const marked = JSON.stringify(s.hooks.SessionStart).match(/rad-orc-preamble/g) ?? [];
  assert.equal(marked.length, 1);
});

test('remove drops only the marked entry, leaving other SessionStart hooks intact', () => {
  const file = tmpSettings({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'keep-me' }] }] } });
  mergePreambleHook({ settingsPath: file, hookCommand: 'node preamble' });
  removePreambleHook({ settingsPath: file });
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(JSON.stringify(s.hooks.SessionStart).includes('keep-me'));
  assert.ok(!JSON.stringify(s.hooks.SessionStart).includes('rad-orc-preamble'));
});
