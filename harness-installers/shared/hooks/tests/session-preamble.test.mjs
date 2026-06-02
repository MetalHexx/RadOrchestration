import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildHookOutput, resolveRadorch, emitHookResult, serializeForStdout } from '../session-preamble.mjs';

test('wraps the preamble in additionalContext on ok envelope', () => {
  const run = () => ({ status: 0, stdout: JSON.stringify({ ok: true, data: { preamble: 'Rad Orc Initialized!\n/rad-repo' } }) });
  const out = buildHookOutput({ run });
  assert.match(out.additionalContext, /Rad Orc Initialized!/);
  assert.match(out.additionalContext, /\/rad-repo/);
});

test('surfaces a clear notice and never throws when the command returns ok:false', () => {
  const run = () => ({ status: 1, stdout: JSON.stringify({ ok: false, error: { type: 'system_error', message: 'malformed registry' } }) });
  const out = buildHookOutput({ run });
  assert.match(out.additionalContext, /ambient awareness/i);
  assert.match(out.additionalContext, /malformed registry/);
});

test('surfaces a notice when the command output is unparseable', () => {
  const run = () => ({ status: 0, stdout: 'not json' });
  const out = buildHookOutput({ run });
  assert.match(out.additionalContext, /ambient awareness/i);
});

test('resolveRadorch roots under COPILOT_PLUGIN_ROOT when CLAUDE_PLUGIN_ROOT is unset (FR-16)', () => {
  const prevClaude = process.env.CLAUDE_PLUGIN_ROOT;
  const prevCopilot = process.env.COPILOT_PLUGIN_ROOT;
  try {
    delete process.env.CLAUDE_PLUGIN_ROOT;
    process.env.COPILOT_PLUGIN_ROOT = path.join('tmp', 'copilot-root');
    const resolved = resolveRadorch();
    const expected = path.join('tmp', 'copilot-root', 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs');
    assert.strictEqual(resolved, expected);
  } finally {
    if (prevClaude === undefined) delete process.env.CLAUDE_PLUGIN_ROOT;
    else process.env.CLAUDE_PLUGIN_ROOT = prevClaude;
    if (prevCopilot === undefined) delete process.env.COPILOT_PLUGIN_ROOT;
    else process.env.COPILOT_PLUGIN_ROOT = prevCopilot;
  }
});

test('resolveRadorch still roots under CLAUDE_PLUGIN_ROOT when it is set (no regression)', () => {
  const prevClaude = process.env.CLAUDE_PLUGIN_ROOT;
  const prevCopilot = process.env.COPILOT_PLUGIN_ROOT;
  try {
    process.env.CLAUDE_PLUGIN_ROOT = path.join('tmp', 'claude-root');
    process.env.COPILOT_PLUGIN_ROOT = path.join('tmp', 'copilot-root');
    const resolved = resolveRadorch();
    const expected = path.join('tmp', 'claude-root', 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs');
    assert.strictEqual(resolved, expected);
  } finally {
    if (prevClaude === undefined) delete process.env.CLAUDE_PLUGIN_ROOT;
    else process.env.CLAUDE_PLUGIN_ROOT = prevClaude;
    if (prevCopilot === undefined) delete process.env.COPILOT_PLUGIN_ROOT;
    else process.env.COPILOT_PLUGIN_ROOT = prevCopilot;
  }
});

test('resolveRadorch no-env fallback resolves relative to hook file location, not a hardcoded ~/.claude root', () => {
  const prevClaude = process.env.CLAUDE_PLUGIN_ROOT;
  const prevCopilot = process.env.COPILOT_PLUGIN_ROOT;
  try {
    delete process.env.CLAUDE_PLUGIN_ROOT;
    delete process.env.COPILOT_PLUGIN_ROOT;
    const resolved = resolveRadorch();
    // The hook lives at <harnessRoot>/hooks/session-preamble.mjs.
    // Derive the expected path from this test file's location:
    // this test is at <harnessRoot>/hooks/tests/session-preamble.test.mjs
    // so hookDir is one level up from here.
    const hookDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
    // <harnessRoot> is ONE level up from hooks/ — the directory containing hooks/.
    const expectedHarnessRoot = path.resolve(hookDir, '..');
    const expected = path.join(expectedHarnessRoot, 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs');
    assert.strictEqual(resolved, expected);
    // Must NOT contain a hardcoded ~/.claude segment
    assert.ok(
      !resolved.includes(path.join('.claude', 'skills')),
      `Expected path to not contain a hardcoded .claude root but got: ${resolved}`,
    );
  } finally {
    if (prevClaude === undefined) delete process.env.CLAUDE_PLUGIN_ROOT;
    else process.env.CLAUDE_PLUGIN_ROOT = prevClaude;
    if (prevCopilot === undefined) delete process.env.COPILOT_PLUGIN_ROOT;
    else process.env.COPILOT_PLUGIN_ROOT = prevCopilot;
  }
});

test('emitHookResult surfaces the additionalContext text as the stdout payload', () => {
  // Mirrors the existing drift-check SessionStart hook: the context text is
  // written straight to stdout (the additionalContext channel).
  assert.strictEqual(emitHookResult({ additionalContext: 'Rad Orc Initialized!' }), 'Rad Orc Initialized!');
});

test('emitHookResult is soft and returns empty string for missing/empty output', () => {
  assert.strictEqual(emitHookResult(undefined), '');
  assert.strictEqual(emitHookResult({}), '');
});

test('serializeForStdout wraps text as bare-JSON additionalContext under Copilot CLI (COPILOT_CLI=1)', () => {
  // Copilot CLI discards raw stdout; a sessionStart hook must emit a JSON object
  // with a BARE top-level additionalContext. See docs/research/copilot-cli-hooks.md.
  const parsed = JSON.parse(serializeForStdout('hello preamble', { COPILOT_CLI: '1' }));
  assert.deepStrictEqual(parsed, { additionalContext: 'hello preamble' });
});

test('serializeForStdout wraps text as nested hookSpecificOutput.additionalContext off Copilot CLI (Claude Code + VS Code)', () => {
  // VS Code parses stdout as JSON and injects ONLY from the nested field; Claude
  // Code accepts the same nested shape. See docs/research/copilot-vscode-hooks.md.
  const parsed = JSON.parse(serializeForStdout('hello preamble', {}));
  assert.deepStrictEqual(parsed, {
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'hello preamble' },
  });
});

test('serializeForStdout returns empty string for empty text so the caller writes nothing', () => {
  assert.strictEqual(serializeForStdout('', { COPILOT_CLI: '1' }), '');
  assert.strictEqual(serializeForStdout(undefined, {}), '');
});

test('main-execution block emits the preamble as nested JSON and never throws (non-CLI harness)', () => {
  // Run the hook as the entry point. With no plugin root and no installed
  // radorch, the default run resolves to the notice path — proving the module
  // emits SOMETHING to stdout (it is no longer silent when fired as a hook).
  // Off Copilot CLI, the payload is the nested hookSpecificOutput shape.
  const hookPath = fileURLToPath(new URL('../session-preamble.mjs', import.meta.url));
  const env = { ...process.env };
  delete env.CLAUDE_PLUGIN_ROOT;
  delete env.COPILOT_PLUGIN_ROOT;
  delete env.COPILOT_CLI;
  const result = spawnSync(process.execPath, [hookPath], { encoding: 'utf8', env });
  assert.strictEqual(result.status, 0, 'hook exits cleanly (never throws)');
  assert.ok(result.stdout.trim().length > 0, 'hook writes a non-empty payload to stdout');
  const parsed = JSON.parse(result.stdout);
  assert.strictEqual(parsed.hookSpecificOutput?.hookEventName, 'SessionStart');
  assert.match(parsed.hookSpecificOutput.additionalContext, /ambient awareness/i, 'notice flows through the nested wrapper');
});

test('emits via `node -e import()` — the Claude/VSCode hooks.json dynamic-import launch (argv[1] undefined)', () => {
  // Regression guard: the real Claude / Copilot-VSCode hooks.json wraps the hook
  // in `node -e "import(pathToFileURL(hook))"` (so the Windows CLAUDE_PLUGIN_ROOT
  // `/c/`→`C:` fixup runs before the module loads). Under `node -e`, process.argv[1]
  // is undefined — and the entry-point block used to require argv[1] to be truthy,
  // so it stayed SILENT in exactly this (deployed) launch mode. Asserts the module
  // now emits when imported with no entry script. With no plugin root + no installed
  // radorch the default run resolves to the notice path, proving stdout is non-empty.
  const hookPath = fileURLToPath(new URL('../session-preamble.mjs', import.meta.url));
  const code = `import('node:url').then(u=>import(u.pathToFileURL(${JSON.stringify(hookPath)}).href))`;
  const env = { ...process.env };
  delete env.CLAUDE_PLUGIN_ROOT;
  delete env.COPILOT_PLUGIN_ROOT;
  delete env.COPILOT_CLI;
  const result = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8', env });
  assert.strictEqual(result.status, 0, 'dynamic-import launch exits cleanly (never throws)');
  assert.ok(result.stdout.trim().length > 0, 'main block fires under `node -e import()` (was silent before the guard fix)');
  assert.match(result.stdout, /ambient awareness/i, 'falls back to the notice payload when radorch is unavailable');
});

test('main-execution block emits bare-JSON additionalContext under COPILOT_CLI=1 (Copilot CLI contract)', () => {
  // End-to-end: when fired as the hook under Copilot CLI, stdout must be a JSON
  // object with a top-level additionalContext — raw stdout is discarded by the
  // CLI (docs/research/copilot-cli-hooks.md). With no plugin root + no installed
  // radorch the default run resolves to the notice path, proving the JSON wrapper
  // carries whatever text the hook produces.
  const hookPath = fileURLToPath(new URL('../session-preamble.mjs', import.meta.url));
  const env = { ...process.env };
  delete env.CLAUDE_PLUGIN_ROOT;
  delete env.COPILOT_PLUGIN_ROOT;
  env.COPILOT_CLI = '1';
  const result = spawnSync(process.execPath, [hookPath], { encoding: 'utf8', env });
  assert.strictEqual(result.status, 0, 'hook exits cleanly (never throws)');
  const parsed = JSON.parse(result.stdout);
  assert.ok(
    typeof parsed.additionalContext === 'string' && parsed.additionalContext.length > 0,
    'stdout is a JSON object with a non-empty top-level additionalContext',
  );
  assert.match(parsed.additionalContext, /ambient awareness/i, 'notice payload flows through the JSON wrapper');
});
