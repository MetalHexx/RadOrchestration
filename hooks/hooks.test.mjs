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
  const entry = sessionStart[0];
  assert.match(entry.command, /\bnode\b/);
  assert.match(entry.command, /bin[\/\\]radorch\.mjs/);
  assert.match(entry.command, /plugin-bootstrap/);
  assert.match(entry.command, /--quiet/);
  assert.match(entry.command, /--harness\s+claude/);
  assert.match(entry.command, /--plugin-root\s+\$\{CLAUDE_PLUGIN_ROOT\}/);
});

test('shell scripts are gone', () => {
  assert.ok(!fs.existsSync(path.join(__dirname, 'session-start.sh')));
  assert.ok(!fs.existsSync(path.join(__dirname, 'session-start.ps1')));
  assert.ok(!fs.existsSync(path.join(__dirname, 'session-start.test.mjs')));
});
