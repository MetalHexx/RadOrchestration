// installer/scripts/sync-source.test.js — Tests for sync-source.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { syncSource } from './sync-source.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSandbox() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-source-'));
  return {
    source: path.join(tmpDir, 'source'),
    target: path.join(tmpDir, 'target'),
    cleanup() {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

function writeFile(base, relPath, content = 'content') {
  const full = path.join(base, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

// ── Target directory creation ─────────────────────────────────────────────────

test('creates target directory and copies files when target does not exist', () => {
  const { source, target, cleanup } = makeSandbox();
  try {
    writeFile(source, 'file.txt', 'hello');
    syncSource(source, target);
    assert.ok(fs.existsSync(target), 'target directory should exist');
    assert.ok(fs.existsSync(path.join(target, 'file.txt')), 'file.txt should exist in target');
    assert.equal(fs.readFileSync(path.join(target, 'file.txt'), 'utf8'), 'hello');
  } finally {
    cleanup();
  }
});

// ── Recursive copy ────────────────────────────────────────────────────────────

test('copies files recursively from nested subdirectories', () => {
  const { source, target, cleanup } = makeSandbox();
  try {
    writeFile(source, 'level1/level2/deep.txt', 'deep content');
    writeFile(source, 'level1/shallow.txt', 'shallow content');
    writeFile(source, 'top.txt', 'top content');
    syncSource(source, target);
    assert.ok(fs.existsSync(path.join(target, 'level1', 'level2', 'deep.txt')), 'deep nested file should exist');
    assert.ok(fs.existsSync(path.join(target, 'level1', 'shallow.txt')), 'shallow nested file should exist');
    assert.ok(fs.existsSync(path.join(target, 'top.txt')), 'top level file should exist');
    assert.equal(fs.readFileSync(path.join(target, 'level1', 'level2', 'deep.txt'), 'utf8'), 'deep content');
  } finally {
    cleanup();
  }
});

// ── Clean before copy (idempotency) ──────────────────────────────────────────

test('removes stale content before copying (idempotency)', () => {
  const { source, target, cleanup } = makeSandbox();
  try {
    // First run
    writeFile(source, 'old.txt', 'old');
    syncSource(source, target);
    assert.ok(fs.existsSync(path.join(target, 'old.txt')), 'old.txt should exist after first sync');

    // Update source: remove old.txt, add new.txt
    fs.rmSync(path.join(source, 'old.txt'));
    writeFile(source, 'new.txt', 'new');

    // Second run: target should contain new.txt but NOT old.txt
    syncSource(source, target);
    assert.ok(fs.existsSync(path.join(target, 'new.txt')), 'new.txt should exist after second sync');
    assert.ok(!fs.existsSync(path.join(target, 'old.txt')), 'old.txt should be removed (clean slate)');
  } finally {
    cleanup();
  }
});

// ── Success message ───────────────────────────────────────────────────────────

test('logs a success message to stdout', () => {
  const { source, target, cleanup } = makeSandbox();
  try {
    writeFile(source, 'file.txt');
    const logs = [];
    const original = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      syncSource(source, target);
    } finally {
      console.log = original;
    }
    assert.ok(logs.length > 0, 'should have logged at least one message');
    assert.ok(logs[0].includes('.github'), 'log message should mention .github');
  } finally {
    cleanup();
  }
});
