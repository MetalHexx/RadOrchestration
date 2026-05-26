// hooks-shim.test.mjs — regression guard for the cross-platform path-normalization
// shim embedded in hooks.json. The shim is inline (Claude Code can't load a
// helper module before its own path is normalized), so the deployed JS lives
// as a string inside hooks/hooks.json. This test asserts:
//   1. hooks.json carries the shim shape we expect (both hooks, right target),
//      and contains NO backslash literals (those interact badly with shells'
//      double-quote stripping — iter-1's `.join('\\')` bug was caught here).
//   2. The normalization algorithm produces the right output across platforms.
//   3. The deployed command string survives shell quoting end-to-end when
//      invoked via `bash -c` and `cmd /c` (Windows). Catches shell-escape
//      regressions without requiring a plugin reinstall.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HOOKS_JSON = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../hooks/hooks.json',
);

// Re-implementation of the shim's normalize step — keep in sync with the
// expression inside hooks.json. The string-shape assertion below cross-checks
// that the deployed command contains the same algorithm.
function normalize(r, plat) {
  return plat === 'win32' && r[0] === '/' && r[2] === '/'
    ? r[1].toUpperCase() + ':' + r.slice(2)
    : r;
}

test('hooks.json carries shim shape for UserPromptSubmit + SessionStart', () => {
  const json = JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf8'));
  const ups = json.hooks?.UserPromptSubmit?.[0]?.hooks?.[0]?.command;
  const ses = json.hooks?.SessionStart?.[0]?.hooks?.[0]?.command;
  assert.ok(typeof ups === 'string', 'UserPromptSubmit command present');
  assert.ok(typeof ses === 'string', 'SessionStart command present');
  for (const [name, cmd] of [['UserPromptSubmit', ups], ['SessionStart', ses]]) {
    assert.ok(cmd.startsWith('node -e '), `${name}: shim is node -e form`);
    assert.match(cmd, /process\.env\.CLAUDE_PLUGIN_ROOT/, `${name}: reads env var`);
    assert.match(cmd, /process\.platform==='win32'/, `${name}: gates on win32`);
    assert.match(cmd, /r\[0\]==='\/'&&r\[2\]==='\/'/, `${name}: matches /<letter>/ shape`);
    assert.match(cmd, /pathToFileURL/, `${name}: builds file:// URL`);
    assert.match(cmd, /process\.env\.CLAUDE_PLUGIN_ROOT=n/, `${name}: writes normalized env back`);
    // Iter-1 had `.split('/').join('\\')`. JSON-decoding turned `\\\\` into
    // `\\`, then bash's outer `"..."` collapsed it to `\` → unterminated JS
    // string → [eval]:1 SyntaxError. Forbid backslash literals to keep the
    // shim shell-portable. Each `\\` in the JSON value decodes to a single
    // backslash; we require zero.
    const backslashes = (cmd.match(/\\/g) || []).length;
    assert.equal(backslashes, 0, `${name}: no backslash literals (got ${backslashes})`);
  }
  assert.match(ups, /\/hooks\/bootstrap\.mjs/, 'UserPromptSubmit targets bootstrap.mjs');
  assert.match(ses, /\/hooks\/drift-check\.mjs/, 'SessionStart targets drift-check.mjs');
});

test('normalize: linux passthrough', () => {
  const r = '/Users/foo/.claude/plugins/cache/rad/1.0';
  assert.equal(normalize(r, 'linux'), r);
});

test('normalize: darwin passthrough', () => {
  const r = '/Users/foo/Library/Application Support/.claude/plugins/cache/rad/1.0';
  assert.equal(normalize(r, 'darwin'), r);
});

test('normalize: win32 native passthrough (backslash form left alone)', () => {
  const r = 'C:\\Users\\foo\\.claude\\plugins\\cache\\rad\\1.0';
  assert.equal(normalize(r, 'win32'), r);
});

test('normalize: win32 Unix-style /c/... → C:/...', () => {
  const r = '/c/Users/foo/.claude/plugins/cache/rad/1.0';
  assert.equal(
    normalize(r, 'win32'),
    'C:/Users/foo/.claude/plugins/cache/rad/1.0',
  );
});

test('normalize: win32 lowercase drive letter is uppercased', () => {
  assert.equal(normalize('/d/work/repo', 'win32'), 'D:/work/repo');
});

test('normalize: empty env var stays empty (no crash)', () => {
  assert.equal(normalize('', 'win32'), '');
  assert.equal(normalize('', 'linux'), '');
});

// Live shell-roundtrip tests — these are what would have caught iter-1's
// `.join('\\')` regression BEFORE we shipped a broken hooks.json into the
// plugin cache. We stage a tiny fixture plugin root (just hooks/bootstrap.mjs
// printing a sentinel), point CLAUDE_PLUGIN_ROOT at it in Unix-style form
// (`/c/...` on Windows, native POSIX path elsewhere), and invoke the LIVE
// hooks.json command via bash or cmd. The shim must survive shell quoting.

function stageFixturePluginRoot() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'shim-'));
  fs.mkdirSync(path.join(fixture, 'hooks'), { recursive: true });
  // Sentinel-only bootstrap — avoids running the real install logic, which
  // would touch ~/.radorc/. The test only needs to know the shim was able
  // to dynamic-import the file pointed at by the normalized CLAUDE_PLUGIN_ROOT.
  fs.writeFileSync(
    path.join(fixture, 'hooks', 'bootstrap.mjs'),
    'process.stdout.write("SHIM-OK\\n");\n',
  );
  fs.writeFileSync(
    path.join(fixture, 'hooks', 'drift-check.mjs'),
    'process.stdout.write("SHIM-OK\\n");\n',
  );
  return fixture;
}

function toUnixForm(absPath) {
  // /c/Users/... on Windows for an absolute Windows path, native otherwise.
  if (process.platform !== 'win32') return absPath;
  const drive = absPath[0].toLowerCase();
  const rest = absPath.slice(2).split(path.sep).join('/');
  return `/${drive}${rest}`;
}

function bashAvailable() {
  const r = spawnSync('bash', ['-c', 'true'], { stdio: 'ignore' });
  return r.status === 0;
}

test('deployed UserPromptSubmit command survives bash -c shell quoting', () => {
  if (!bashAvailable()) {
    // Most CI Linux/macOS images have bash; skip cleanly when absent.
    return;
  }
  const fixture = stageFixturePluginRoot();
  try {
    const json = JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf8'));
    const command = json.hooks.UserPromptSubmit[0].hooks[0].command;
    const unixRoot = toUnixForm(fixture);
    const res = spawnSync('bash', ['-c', command], {
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: unixRoot },
      encoding: 'utf8',
    });
    assert.equal(
      res.status,
      0,
      `bash roundtrip exit code\nstdout: ${res.stdout}\nstderr: ${res.stderr}`,
    );
    assert.match(res.stdout, /SHIM-OK/, 'fixture bootstrap.mjs was imported');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('deployed SessionStart command survives bash -c shell quoting', () => {
  if (!bashAvailable()) return;
  const fixture = stageFixturePluginRoot();
  try {
    const json = JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf8'));
    const command = json.hooks.SessionStart[0].hooks[0].command;
    const unixRoot = toUnixForm(fixture);
    const res = spawnSync('bash', ['-c', command], {
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: unixRoot },
      encoding: 'utf8',
    });
    assert.equal(res.status, 0, `stderr: ${res.stderr}`);
    assert.match(res.stdout, /SHIM-OK/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('deployed UserPromptSubmit command survives the OS default shell (shell: true)', () => {
  // `shell: true` exercises the OS-default shell (cmd.exe on Windows via
  // `cmd /d /s /c "<cmd>"`, /bin/sh on POSIX). This is the invocation
  // path child_process.spawn uses when callers pass a command string —
  // closest to what Claude Code likely does to fire hooks.
  const fixture = stageFixturePluginRoot();
  try {
    const json = JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf8'));
    const command = json.hooks.UserPromptSubmit[0].hooks[0].command;
    const unixRoot = toUnixForm(fixture);
    const res = spawnSync(command, {
      shell: true,
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: unixRoot },
      encoding: 'utf8',
    });
    assert.equal(
      res.status,
      0,
      `default-shell roundtrip exit code\nstdout: ${res.stdout}\nstderr: ${res.stderr}`,
    );
    assert.match(res.stdout, /SHIM-OK/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('deployed command also works when CLAUDE_PLUGIN_ROOT is already Windows-form', { skip: process.platform !== 'win32' }, () => {
  if (!bashAvailable()) return;
  const fixture = stageFixturePluginRoot();
  try {
    const json = JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf8'));
    const command = json.hooks.UserPromptSubmit[0].hooks[0].command;
    const res = spawnSync('bash', ['-c', command], {
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: fixture },
      encoding: 'utf8',
    });
    assert.equal(res.status, 0, `stderr: ${res.stderr}`);
    assert.match(res.stdout, /SHIM-OK/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
