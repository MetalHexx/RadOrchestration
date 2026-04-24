'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseArgs, pickTheme, writeSettings, ensureGitignore, THEMES } = require('./inject-theme');

// ─── parseArgs ───────────────────────────────────────────────────────────────

describe('parseArgs', () => {

  it('parses --worktree-path', () => {
    const result = parseArgs(['node', 'script.js', '--worktree-path', '/wt/PROJ']);
    assert.equal(result.worktreePath, '/wt/PROJ');
  });

  it('returns null when flag is absent', () => {
    const result = parseArgs(['node', 'script.js']);
    assert.equal(result.worktreePath, null);
  });

  it('ignores unknown flags', () => {
    const result = parseArgs(['node', 'script.js', '--foo', 'bar', '--worktree-path', '/x']);
    assert.equal(result.worktreePath, '/x');
  });
});

// ─── pickTheme ───────────────────────────────────────────────────────────────

describe('pickTheme', () => {

  it('returns a string from the list', () => {
    const theme = pickTheme(THEMES);
    assert.ok(typeof theme === 'string');
    assert.ok(THEMES.includes(theme));
  });

  it('works with a single-item list', () => {
    assert.equal(pickTheme(['Only Theme']), 'Only Theme');
  });

  it('THEMES list has at least 2 entries', () => {
    assert.ok(THEMES.length >= 2);
  });
});

// ─── writeSettings ───────────────────────────────────────────────────────────

describe('writeSettings', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inject-theme-test-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .vscode/settings.json with the correct theme', () => {
    const settingsPath = writeSettings(tmpDir, 'Monokai');
    assert.ok(fs.existsSync(settingsPath));
    const contents = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    assert.equal(contents['workbench.colorTheme'], 'Monokai');
  });

  it('returns the absolute path to settings.json', () => {
    const settingsPath = writeSettings(tmpDir, 'Abyss');
    assert.equal(settingsPath, path.join(tmpDir, '.vscode', 'settings.json'));
  });

  it('merges theme into existing settings without overwriting other keys', () => {
    const subDir = path.join(tmpDir, 'merge');
    fs.mkdirSync(subDir);
    const vsDir = path.join(subDir, '.vscode');
    fs.mkdirSync(vsDir);
    fs.writeFileSync(path.join(vsDir, 'settings.json'), JSON.stringify({ 'editor.fontSize': 14 }, null, 2), 'utf8');
    writeSettings(subDir, 'Red');
    const contents = JSON.parse(fs.readFileSync(path.join(vsDir, 'settings.json'), 'utf8'));
    assert.equal(contents['workbench.colorTheme'], 'Red');
    assert.equal(contents['editor.fontSize'], 14);
  });

  it('overwrites only the theme key when settings.json already has one', () => {
    const subDir = path.join(tmpDir, 'overwrite-theme');
    fs.mkdirSync(subDir);
    writeSettings(subDir, 'Red');
    writeSettings(subDir, 'Quiet Light');
    const contents = JSON.parse(fs.readFileSync(path.join(subDir, '.vscode', 'settings.json'), 'utf8'));
    assert.equal(contents['workbench.colorTheme'], 'Quiet Light');
  });

  it('recovers from unparseable settings.json', () => {
    const subDir = path.join(tmpDir, 'corrupt');
    fs.mkdirSync(path.join(subDir, '.vscode'), { recursive: true });
    fs.writeFileSync(path.join(subDir, '.vscode', 'settings.json'), 'NOT JSON', 'utf8');
    writeSettings(subDir, 'Solarized Dark');
    const contents = JSON.parse(fs.readFileSync(path.join(subDir, '.vscode', 'settings.json'), 'utf8'));
    assert.equal(contents['workbench.colorTheme'], 'Solarized Dark');
  });

  it('creates .vscode dir if it does not exist', () => {
    const subDir = path.join(tmpDir, 'fresh');
    fs.mkdirSync(subDir);
    writeSettings(subDir, 'Solarized Dark');
    assert.ok(fs.existsSync(path.join(subDir, '.vscode', 'settings.json')));
  });
});

// ─── ensureGitignore ─────────────────────────────────────────────────────────

describe('ensureGitignore', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inject-theme-gi-test-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .gitignore with the entry when file does not exist', () => {
    const subDir = path.join(tmpDir, 'fresh');
    fs.mkdirSync(subDir);
    ensureGitignore(subDir);
    const contents = fs.readFileSync(path.join(subDir, '.gitignore'), 'utf8');
    assert.ok(contents.includes('.vscode/settings.json'));
  });

  it('returns the absolute path to .gitignore', () => {
    const subDir = path.join(tmpDir, 'pathcheck');
    fs.mkdirSync(subDir);
    const giPath = ensureGitignore(subDir);
    assert.equal(giPath, path.join(subDir, '.gitignore'));
  });

  it('appends the entry to an existing .gitignore that lacks it', () => {
    const subDir = path.join(tmpDir, 'existing');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, '.gitignore'), 'node_modules\n', 'utf8');
    ensureGitignore(subDir);
    const contents = fs.readFileSync(path.join(subDir, '.gitignore'), 'utf8');
    assert.ok(contents.includes('node_modules'));
    assert.ok(contents.includes('.vscode/settings.json'));
  });

  it('does not duplicate the entry when called twice', () => {
    const subDir = path.join(tmpDir, 'dedup');
    fs.mkdirSync(subDir);
    ensureGitignore(subDir);
    ensureGitignore(subDir);
    const contents = fs.readFileSync(path.join(subDir, '.gitignore'), 'utf8');
    const matches = contents.split('\n').filter(l => l.trim() === '.vscode/settings.json');
    assert.equal(matches.length, 1);
  });

  it('handles existing file with no trailing newline', () => {
    const subDir = path.join(tmpDir, 'nonewline');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, '.gitignore'), 'dist', 'utf8');
    ensureGitignore(subDir);
    const contents = fs.readFileSync(path.join(subDir, '.gitignore'), 'utf8');
    assert.ok(contents.includes('\n.vscode/settings.json'));
  });
});
