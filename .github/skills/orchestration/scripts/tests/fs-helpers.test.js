'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const { exists, isDirectory, listFiles, listDirs, readFile } = require('../validate/lib/utils/fs-helpers');

// ─── Test Helpers ───────────────────────────────────────────────────────────

let tmpDir;
let passed = 0;
let failed = 0;
const results = [];

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-helpers-test-'));
  // Create test files
  fs.writeFileSync(path.join(tmpDir, 'file1.md'), '# Hello\nWorld');
  fs.writeFileSync(path.join(tmpDir, 'file2.txt'), 'plain text');
  fs.writeFileSync(path.join(tmpDir, 'file3.md'), '# Another');
  // Create test subdirectories
  fs.mkdirSync(path.join(tmpDir, 'subdir1'));
  fs.mkdirSync(path.join(tmpDir, 'subdir2'));
}

function teardown() {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push({ name, status: 'pass' });
  } catch (err) {
    failed++;
    results.push({ name, status: 'fail', error: err.message });
    console.error(`  FAIL: ${name}\n        ${err.message}`);
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

setup();

try {
  // --- exists() ---
  test('exists() returns true for a file that exists', () => {
    assert.strictEqual(exists(path.join(tmpDir, 'file1.md')), true);
  });

  test('exists() returns true for a directory that exists', () => {
    assert.strictEqual(exists(tmpDir), true);
  });

  test('exists() returns false for a path that does not exist', () => {
    assert.strictEqual(exists(path.join(tmpDir, 'nonexistent.txt')), false);
  });

  test('exists() returns false (not throws) for invalid/malformed path', () => {
    // Null bytes in path should trigger an error inside existsSync
    assert.strictEqual(exists('\0invalid'), false);
  });

  // --- isDirectory() ---
  test('isDirectory() returns true for an existing directory', () => {
    assert.strictEqual(isDirectory(tmpDir), true);
  });

  test('isDirectory() returns false for an existing file', () => {
    assert.strictEqual(isDirectory(path.join(tmpDir, 'file1.md')), false);
  });

  test('isDirectory() returns false for a non-existent path', () => {
    assert.strictEqual(isDirectory(path.join(tmpDir, 'no-such-dir')), false);
  });

  test('isDirectory() returns false (not throws) on error', () => {
    assert.strictEqual(isDirectory('\0invalid'), false);
  });

  // --- listFiles() ---
  test('listFiles() returns array of filenames for a valid directory', () => {
    const files = listFiles(tmpDir);
    assert.ok(Array.isArray(files));
    assert.ok(files.length >= 3);
    assert.ok(files.includes('file1.md'));
    assert.ok(files.includes('file2.txt'));
    assert.ok(files.includes('file3.md'));
  });

  test('listFiles() with suffix returns only matching files', () => {
    const files = listFiles(tmpDir, '.md');
    assert.ok(files.includes('file1.md'));
    assert.ok(files.includes('file3.md'));
    assert.ok(!files.includes('file2.txt'));
  });

  test('listFiles() without suffix returns all files', () => {
    const files = listFiles(tmpDir);
    assert.ok(files.includes('file1.md'));
    assert.ok(files.includes('file2.txt'));
    assert.ok(files.includes('file3.md'));
  });

  test('listFiles() does NOT include subdirectory names', () => {
    const files = listFiles(tmpDir);
    assert.ok(!files.includes('subdir1'));
    assert.ok(!files.includes('subdir2'));
  });

  test('listFiles() returns [] for a non-existent directory', () => {
    const files = listFiles(path.join(tmpDir, 'nonexistent'));
    assert.deepStrictEqual(files, []);
  });

  test('listFiles() returns [] (not throws) on error', () => {
    const files = listFiles('\0invalid');
    assert.deepStrictEqual(files, []);
  });

  // --- listDirs() ---
  test('listDirs() returns array of directory names for a valid directory', () => {
    const dirs = listDirs(tmpDir);
    assert.ok(Array.isArray(dirs));
    assert.ok(dirs.includes('subdir1'));
    assert.ok(dirs.includes('subdir2'));
  });

  test('listDirs() does NOT include files in the result', () => {
    const dirs = listDirs(tmpDir);
    assert.ok(!dirs.includes('file1.md'));
    assert.ok(!dirs.includes('file2.txt'));
  });

  test('listDirs() returns [] for a non-existent directory', () => {
    const dirs = listDirs(path.join(tmpDir, 'nonexistent'));
    assert.deepStrictEqual(dirs, []);
  });

  test('listDirs() returns [] (not throws) on error', () => {
    const dirs = listDirs('\0invalid');
    assert.deepStrictEqual(dirs, []);
  });

  // --- readFile() ---
  test('readFile() returns UTF-8 string for a valid readable file', () => {
    const content = readFile(path.join(tmpDir, 'file1.md'));
    assert.strictEqual(content, '# Hello\nWorld');
  });

  test('readFile() returns null for a non-existent file', () => {
    const content = readFile(path.join(tmpDir, 'nonexistent.txt'));
    assert.strictEqual(content, null);
  });

  test('readFile() returns null (not throws) on error', () => {
    const content = readFile('\0invalid');
    assert.strictEqual(content, null);
  });

} finally {
  teardown();
}

// ─── Report ─────────────────────────────────────────────────────────────────

console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
results.forEach(r => {
  const icon = r.status === 'pass' ? '✓' : '✗';
  console.log(`  ${icon} ${r.name}`);
});

if (failed > 0) {
  process.exit(1);
}
