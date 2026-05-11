// installer/lib/path-utils.test.js — Tests for path-utils.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { isValidFolderName, resolveOrchRoot, normalizePath } from './path-utils.js';

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

// ── normalizePath ──────────────────────────────────────────────────────────────────────

test('normalizePath - replaces backslashes with forward slashes', () => {
  assert.strictEqual(normalizePath('docs\\projects'), 'docs/projects');
});

test('normalizePath - replaces mixed backslashes and forward slashes', () => {
  assert.strictEqual(normalizePath('docs\\sub/projects'), 'docs/sub/projects');
});

test('normalizePath - strips trailing forward slash', () => {
  assert.strictEqual(normalizePath('docs/projects/'), 'docs/projects');
});

test('normalizePath - collapses consecutive forward slashes', () => {
  assert.strictEqual(normalizePath('docs//projects'), 'docs/projects');
});

test('normalizePath - preserves leading slash (absolute path)', () => {
  assert.strictEqual(normalizePath('/absolute/path/'), '/absolute/path');
});

test('normalizePath - normalizes Windows absolute path', () => {
  assert.strictEqual(normalizePath('C:\\dev\\root\\'), 'C:/dev/root');
});

test('normalizePath - clean relative path passes through unchanged', () => {
  assert.strictEqual(normalizePath('orchestration-projects'), 'orchestration-projects');
});

test('normalizePath - lone slash is preserved', () => {
  assert.strictEqual(normalizePath('/'), '/');
});
