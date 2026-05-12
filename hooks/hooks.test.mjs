import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

test('hooks.json SessionStart invokes node bin/radorch.mjs plugin-bootstrap', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'hooks.json'), 'utf8'));
  const sessionStart = manifest.hooks.SessionStart;
  assert.equal(sessionStart.length, 1, 'expected exactly one SessionStart entry — shell-specific scripts retire');
  const matcher = sessionStart[0];
  assert.equal(matcher.hooks.length, 1, 'expected exactly one hook inside the SessionStart matcher entry');
  const hook = matcher.hooks[0];
  assert.equal(hook.type, 'command');
  assert.match(hook.command, /\bnode\b/);
  assert.match(hook.command, /bin[\/\\]radorch\.mjs/);
  assert.match(hook.command, /plugin-bootstrap/);
  assert.match(hook.command, /--quiet/);
  assert.match(hook.command, /--harness\s+claude/);
  assert.match(hook.command, /--plugin-root\s+\$\{CLAUDE_PLUGIN_ROOT\}/);
});

test('shell scripts are gone', () => {
  assert.ok(!fs.existsSync(path.join(__dirname, 'session-start.sh')));
  assert.ok(!fs.existsSync(path.join(__dirname, 'session-start.ps1')));
  assert.ok(!fs.existsSync(path.join(__dirname, 'session-start.test.mjs')));
});
