import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

test('hooks.json registers UserPromptSubmit pointing at bootstrap-then-uninstall.mjs', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'hooks.json'), 'utf8'));
  // SessionStart is intentionally absent — see hooks/AGENTS.md for why.
  assert.equal(manifest.hooks.SessionStart, undefined, 'SessionStart must not be registered');
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

test('bootstrap-then-uninstall.mjs ships alongside hooks.json', () => {
  const wrapper = path.join(__dirname, 'bootstrap-then-uninstall.mjs');
  assert.ok(fs.existsSync(wrapper), 'bootstrap-then-uninstall.mjs must exist in hooks/');
});

test('no stray shell-script hooks from the prior SessionStart implementation', () => {
  assert.ok(!fs.existsSync(path.join(__dirname, 'session-start.sh')));
  assert.ok(!fs.existsSync(path.join(__dirname, 'session-start.ps1')));
  assert.ok(!fs.existsSync(path.join(__dirname, 'session-start.test.mjs')));
});
