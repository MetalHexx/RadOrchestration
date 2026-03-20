// installer/lib/path-utils.test.js — Tests for path-utils.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { toDockerPath, isValidFolderName, resolveOrchRoot } from './path-utils.js';

// ── toDockerPath ─────────────────────────────────────────────────────────────

test('toDockerPath - C:\\Users\\dev\\project → /c/Users/dev/project', () => {
  assert.strictEqual(toDockerPath('C:\\Users\\dev\\project'), '/c/Users/dev/project');
});

test('toDockerPath - D:\\Work\\repo → /d/Work/repo', () => {
  assert.strictEqual(toDockerPath('D:\\Work\\repo'), '/d/Work/repo');
});

test('toDockerPath - /home/user/project unchanged (not a Windows path)', () => {
  assert.strictEqual(toDockerPath('/home/user/project'), '/home/user/project');
});

test('toDockerPath - C:/Users/dev/project → /c/Users/dev/project (forward-slash variant)', () => {
  assert.strictEqual(toDockerPath('C:/Users/dev/project'), '/c/Users/dev/project');
});

test('toDockerPath - empty string returns empty string', () => {
  assert.strictEqual(toDockerPath(''), '');
});

test('toDockerPath - D/folder returns D/folder unchanged (no colon, must not be converted)', () => {
  assert.strictEqual(toDockerPath('D/folder'), 'D/folder');
});

// ── isValidFolderName ────────────────────────────────────────────────────────

test('isValidFolderName - .github returns true', () => {
  assert.strictEqual(isValidFolderName('.github'), true);
});

test('isValidFolderName - custom-orch returns true', () => {
  assert.strictEqual(isValidFolderName('custom-orch'), true);
});

test('isValidFolderName - my_folder returns true', () => {
  assert.strictEqual(isValidFolderName('my_folder'), true);
});

test('isValidFolderName - empty string returns error message string', () => {
  const result = isValidFolderName('');
  assert.notStrictEqual(result, true);
  assert.strictEqual(typeof result, 'string');
});

test('isValidFolderName - whitespace-only string returns error message string', () => {
  const result = isValidFolderName('  ');
  assert.notStrictEqual(result, true);
  assert.strictEqual(typeof result, 'string');
});

test('isValidFolderName - foo/bar returns error message string (contains /)', () => {
  const result = isValidFolderName('foo/bar');
  assert.notStrictEqual(result, true);
  assert.strictEqual(typeof result, 'string');
});

test('isValidFolderName - foo\\bar returns error message string (contains \\)', () => {
  const result = isValidFolderName('foo\\bar');
  assert.notStrictEqual(result, true);
  assert.strictEqual(typeof result, 'string');
});

test('isValidFolderName - foo:bar returns error message string (contains :)', () => {
  const result = isValidFolderName('foo:bar');
  assert.notStrictEqual(result, true);
  assert.strictEqual(typeof result, 'string');
});

test('isValidFolderName - my<folder returns error message string (contains <)', () => {
  const result = isValidFolderName('my<folder');
  assert.notStrictEqual(result, true);
  assert.strictEqual(typeof result, 'string');
});

test('isValidFolderName - CON returns error message string (reserved name)', () => {
  const result = isValidFolderName('CON');
  assert.notStrictEqual(result, true);
  assert.strictEqual(typeof result, 'string');
});

test('isValidFolderName - nul returns error message string (reserved, case-insensitive)', () => {
  const result = isValidFolderName('nul');
  assert.notStrictEqual(result, true);
  assert.strictEqual(typeof result, 'string');
});

test('isValidFolderName - COM1 returns error message string (reserved name)', () => {
  const result = isValidFolderName('COM1');
  assert.notStrictEqual(result, true);
  assert.strictEqual(typeof result, 'string');
});

test('isValidFolderName - . returns error message string', () => {
  const result = isValidFolderName('.');
  assert.notStrictEqual(result, true);
  assert.strictEqual(typeof result, 'string');
});

test('isValidFolderName - .. returns error message string', () => {
  const result = isValidFolderName('..');
  assert.notStrictEqual(result, true);
  assert.strictEqual(typeof result, 'string');
});

test('isValidFolderName - /absolute/path returns true (absolute path bypasses validation)', () => {
  assert.strictEqual(isValidFolderName('/absolute/path'), true);
});

// Platform-specific: Windows absolute path
if (process.platform === 'win32') {
  test('isValidFolderName - C:\\absolute\\path returns true (Windows absolute path)', () => {
    assert.strictEqual(isValidFolderName('C:\\absolute\\path'), true);
  });
}

// ── resolveOrchRoot ──────────────────────────────────────────────────────────

test('resolveOrchRoot - relative orchRoot joins with workspaceDir', () => {
  // Use path.join for cross-platform compatibility in the expected value
  assert.strictEqual(
    resolveOrchRoot('/workspace', '.github'),
    path.join('/workspace', '.github')
  );
});

test('resolveOrchRoot - absolute orchRoot returned directly', () => {
  assert.strictEqual(resolveOrchRoot('/workspace', '/custom/absolute'), '/custom/absolute');
});

test('resolveOrchRoot - Windows workspace with relative orchRoot returns joined path', () => {
  const result = resolveOrchRoot('C:\\Users\\dev', '.github');
  assert.strictEqual(result, path.join('C:\\Users\\dev', '.github'));
});
