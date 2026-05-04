'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs, repairMsysPrompt, VALID_MODES } = require('./launch-claude');

// ─── repairMsysPrompt ────────────────────────────────────────────────────────

describe('repairMsysPrompt', () => {

  it('leaves an already-correct slash command unchanged', () => {
    assert.equal(
      repairMsysPrompt('/rad-execute FOO'),
      '/rad-execute FOO'
    );
  });

  it('repairs a forward-slash MSYS-mangled prompt', () => {
    assert.equal(
      repairMsysPrompt('C:/Program Files/Git/rad-execute FOO'),
      '/rad-execute FOO'
    );
  });

  it('repairs a mangled prompt with no trailing rest', () => {
    assert.equal(
      repairMsysPrompt('C:/Program Files/Git/rad-execute'),
      '/rad-execute'
    );
  });

  it('repairs a back-slash MSYS-mangled prompt', () => {
    assert.equal(
      repairMsysPrompt('D:\\Git\\rad-plan Start planning FOO'),
      '/rad-plan Start planning FOO'
    );
  });

  it('repairs a hyphenated slash-command name', () => {
    assert.equal(
      repairMsysPrompt('C:/Program Files/Git/rad-approve-plan FOO'),
      '/rad-approve-plan FOO'
    );
  });

  it('repairs a single-token slash-command name (e.g. /init)', () => {
    assert.equal(
      repairMsysPrompt('C:/Program Files/Git/init FOO'),
      '/init FOO'
    );
  });

  it('preserves a leading tab in the rest portion', () => {
    assert.equal(
      repairMsysPrompt('C:/Program Files/Git/rad-execute\textra'),
      '/rad-execute\textra'
    );
  });

  it('returns empty string unchanged', () => {
    assert.equal(repairMsysPrompt(''), '');
  });

  it('returns null unchanged', () => {
    assert.equal(repairMsysPrompt(null), null);
  });

  it('returns undefined unchanged', () => {
    assert.equal(repairMsysPrompt(undefined), undefined);
  });

  it('leaves plain text without a drive prefix unchanged', () => {
    assert.equal(repairMsysPrompt('just plain text'), 'just plain text');
  });

  it('does not repair when the trailing path token ends with a separator', () => {
    assert.equal(repairMsysPrompt('C:/some/path/'), 'C:/some/path/');
  });

  it('does not repair when the trailing token is not slash-command-shaped', () => {
    // Trailing token starts with a digit → fails the [A-Za-z]... guard.
    assert.equal(repairMsysPrompt('C:/some/123abc'), 'C:/some/123abc');
  });
});

// ─── parseArgs ───────────────────────────────────────────────────────────────

describe('parseArgs', () => {

  it('parses all four flags from a representative argv', () => {
    const argv = [
      'node', 'launch-claude.js',
      '--worktree-path', 'C:\\wt\\PROJ',
      '--projects-base-path', 'C:\\projects',
      '--prompt', '/rad-execute execute project PROJ',
      '--permission-mode', 'auto',
    ];
    assert.deepEqual(parseArgs(argv), {
      worktreePath:   'C:\\wt\\PROJ',
      projectsBase:   'C:\\projects',
      prompt:         '/rad-execute execute project PROJ',
      permissionMode: 'auto',
    });
  });

  it('defaults permission mode to auto when omitted', () => {
    const argv = ['node', 'launch-claude.js', '--worktree-path', '/x'];
    assert.equal(parseArgs(argv).permissionMode, 'auto');
  });

  it('returns null for absent flags (other than permission mode)', () => {
    const result = parseArgs(['node', 'launch-claude.js']);
    assert.equal(result.worktreePath, null);
    assert.equal(result.projectsBase, null);
    assert.equal(result.prompt, null);
  });
});

// ─── VALID_MODES ─────────────────────────────────────────────────────────────

describe('VALID_MODES', () => {

  it('contains the documented Claude Code permission modes', () => {
    assert.ok(VALID_MODES.includes('default'));
    assert.ok(VALID_MODES.includes('acceptEdits'));
    assert.ok(VALID_MODES.includes('bypassPermissions'));
    assert.ok(VALID_MODES.includes('auto'));
    assert.ok(VALID_MODES.includes('plan'));
  });
});
