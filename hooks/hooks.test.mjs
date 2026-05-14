import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

test('hooks.json registers UserPromptSubmit pointing at bootstrap-then-uninstall.mjs', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'hooks.json'), 'utf8'));
  const ups = manifest.hooks.UserPromptSubmit;
  assert.ok(Array.isArray(ups) && ups.length === 1, 'expected exactly one UserPromptSubmit matcher entry');
  const matcher = ups[0];
  assert.equal(matcher.hooks.length, 1, 'expected exactly one hook inside the UserPromptSubmit matcher entry');
  const hook = matcher.hooks[0];
  assert.equal(hook.type, 'command');
  assert.match(hook.command, /\bnode\b/);
  assert.match(hook.command, /hooks[\/\\]bootstrap-then-uninstall\.mjs/);
  assert.match(hook.command, /\$\{CLAUDE_PLUGIN_ROOT\}/);
});

test('hooks.json registers SessionStart pointing at drift-check.mjs', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'hooks.json'), 'utf8'));
  const ss = manifest.hooks.SessionStart;
  assert.ok(Array.isArray(ss) && ss.length === 1, 'expected exactly one SessionStart matcher entry');
  const matcher = ss[0];
  assert.equal(matcher.hooks.length, 1, 'expected exactly one hook inside the SessionStart matcher entry');
  const hook = matcher.hooks[0];
  assert.equal(hook.type, 'command');
  assert.match(hook.command, /\bnode\b/);
  assert.match(hook.command, /hooks[\/\\]drift-check\.mjs/);
  assert.match(hook.command, /\$\{CLAUDE_PLUGIN_ROOT\}/);
});

test('canonical hook scripts ship alongside hooks.json', () => {
  for (const f of ['bootstrap-then-uninstall.mjs', 'drift-check.mjs']) {
    assert.ok(fs.existsSync(path.join(__dirname, f)), `${f} must exist in hooks/`);
  }
});

test('no stray shell-script hooks from the prior SessionStart implementation', () => {
  assert.ok(!fs.existsSync(path.join(__dirname, 'session-start.sh')));
  assert.ok(!fs.existsSync(path.join(__dirname, 'session-start.ps1')));
  assert.ok(!fs.existsSync(path.join(__dirname, 'session-start.test.mjs')));
});
