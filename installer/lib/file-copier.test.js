// installer/lib/file-copier.test.js — Tests for file-copier.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { copyCategory, copyAll } from './file-copier.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDirs() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-repo-'));
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-target-'));
  return {
    repo,
    target,
    cleanup() {
      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    },
  };
}

function writeFile(base, relPath, content = 'test') {
  const full = path.join(base, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

// ── copyCategory — basic copy ─────────────────────────────────────────────────

test('copyCategory copies files from source to target', () => {
  const { repo, target, cleanup } = makeDirs();
  try {
    writeFile(repo, 'src/a.md');
    writeFile(repo, 'src/b.md');
    const cat = { name: 'Test', sourceDir: 'src', targetDir: 'out', recursive: false };
    copyCategory(cat, repo, target);
    assert.ok(fs.existsSync(path.join(target, 'out', 'a.md')));
    assert.ok(fs.existsSync(path.join(target, 'out', 'b.md')));
  } finally {
    cleanup();
  }
});

// ── copyCategory — directory creation ────────────────────────────────────────

test('copyCategory creates target directory if it does not exist', () => {
  const { repo, target, cleanup } = makeDirs();
  try {
    writeFile(repo, 'src/a.md');
    const cat = { name: 'Test', sourceDir: 'src', targetDir: 'new/nested', recursive: false };
    const result = copyCategory(cat, repo, target);
    assert.ok(fs.existsSync(path.join(target, 'new', 'nested')));
    assert.equal(result.success, true);
  } finally {
    cleanup();
  }
});

// ── copyCategory — recursive: false ──────────────────────────────────────────

test('copyCategory with recursive:false copies only top-level files, not subdirectories', () => {
  const { repo, target, cleanup } = makeDirs();
  try {
    writeFile(repo, 'src/top.md');
    writeFile(repo, 'src/sub/nested.md');
    const cat = { name: 'Test', sourceDir: 'src', targetDir: 'out', recursive: false };
    copyCategory(cat, repo, target);
    assert.ok(fs.existsSync(path.join(target, 'out', 'top.md')));
    assert.ok(!fs.existsSync(path.join(target, 'out', 'sub', 'nested.md')));
    assert.ok(!fs.existsSync(path.join(target, 'out', 'sub')));
  } finally {
    cleanup();
  }
});

// ── copyCategory — recursive: true ───────────────────────────────────────────

test('copyCategory with recursive:true copies files and subdirectories recursively', () => {
  const { repo, target, cleanup } = makeDirs();
  try {
    writeFile(repo, 'src/top.md');
    writeFile(repo, 'src/sub/nested.md');
    writeFile(repo, 'src/sub/deep/file.md');
    const cat = { name: 'Test', sourceDir: 'src', targetDir: 'out', recursive: true };
    copyCategory(cat, repo, target);
    assert.ok(fs.existsSync(path.join(target, 'out', 'top.md')));
    assert.ok(fs.existsSync(path.join(target, 'out', 'sub', 'nested.md')));
    assert.ok(fs.existsSync(path.join(target, 'out', 'sub', 'deep', 'file.md')));
  } finally {
    cleanup();
  }
});

// ── copyCategory — excludeDirs ────────────────────────────────────────────────

test('copyCategory respects excludeDirs — excluded directories and their contents are skipped', () => {
  const { repo, target, cleanup } = makeDirs();
  try {
    writeFile(repo, 'src/keep/file.md');
    writeFile(repo, 'src/skip/file.md');
    const cat = {
      name: 'Test',
      sourceDir: 'src',
      targetDir: 'out',
      recursive: true,
      excludeDirs: ['skip'],
    };
    copyCategory(cat, repo, target);
    assert.ok(fs.existsSync(path.join(target, 'out', 'keep', 'file.md')));
    assert.ok(!fs.existsSync(path.join(target, 'out', 'skip')));
  } finally {
    cleanup();
  }
});

// ── copyCategory — excludeFiles ───────────────────────────────────────────────

test('copyCategory respects excludeFiles — excluded files are skipped', () => {
  const { repo, target, cleanup } = makeDirs();
  try {
    writeFile(repo, 'src/keep.md');
    writeFile(repo, 'src/skip.md');
    const cat = {
      name: 'Test',
      sourceDir: 'src',
      targetDir: 'out',
      recursive: false,
      excludeFiles: ['skip.md'],
    };
    copyCategory(cat, repo, target);
    assert.ok(fs.existsSync(path.join(target, 'out', 'keep.md')));
    assert.ok(!fs.existsSync(path.join(target, 'out', 'skip.md')));
  } finally {
    cleanup();
  }
});

// ── copyCategory — CopyResult shape ──────────────────────────────────────────

test('copyCategory returns CopyResult with correct category, fileCount, success fields', () => {
  const { repo, target, cleanup } = makeDirs();
  try {
    writeFile(repo, 'src/a.md');
    const cat = { name: 'Agents', sourceDir: 'src', targetDir: 'out', recursive: false };
    const result = copyCategory(cat, repo, target);
    assert.equal(result.category, 'Agents');
    assert.equal(result.success, true);
    assert.equal(typeof result.fileCount, 'number');
    assert.equal(result.error, undefined);
  } finally {
    cleanup();
  }
});

// ── copyCategory — fileCount accuracy ────────────────────────────────────────

test('copyCategory returns fileCount matching the actual number of files copied', () => {
  const { repo, target, cleanup } = makeDirs();
  try {
    writeFile(repo, 'src/a.md');
    writeFile(repo, 'src/b.md');
    writeFile(repo, 'src/c.md');
    writeFile(repo, 'src/sub/nested.md'); // skipped when recursive: false
    const cat = { name: 'Test', sourceDir: 'src', targetDir: 'out', recursive: false };
    const result = copyCategory(cat, repo, target);
    assert.equal(result.fileCount, 3);
  } finally {
    cleanup();
  }
});

// ── copyCategory — error handling ────────────────────────────────────────────

test('copyCategory returns { success: true, fileCount: 0, skipped: true } when source directory does not exist', () => {
  const { repo, target, cleanup } = makeDirs();
  try {
    const cat = { name: 'Missing', sourceDir: 'nonexistent', targetDir: 'out', recursive: false };
    const result = copyCategory(cat, repo, target);
    assert.equal(result.success, true);
    assert.equal(result.category, 'Missing');
    assert.equal(result.fileCount, 0);
    assert.equal(result.skipped, true);
    assert.equal(result.error, undefined);
  } finally {
    cleanup();
  }
});

// ── copyCategory — skipped vs zero-file success ───────────────────────────────

test('copyCategory with existing empty source dir returns success: true, skipped: undefined', () => {
  const { repo, target, cleanup } = makeDirs();
  try {
    // Create source dir but put no files in it
    fs.mkdirSync(path.join(repo, 'empty-src'), { recursive: true });
    const cat = { name: 'Empty', sourceDir: 'empty-src', targetDir: 'out', recursive: false };
    const result = copyCategory(cat, repo, target);
    assert.equal(result.success, true);
    assert.equal(result.fileCount, 0);
    assert.equal(result.skipped, undefined);
  } finally {
    cleanup();
  }
});

// ── copyAll — basic ───────────────────────────────────────────────────────────

test('copyAll copies all categories and returns CopyResult[] with one entry per category', () => {
  const { repo, target, cleanup } = makeDirs();
  try {
    writeFile(repo, 'cat1/file1.md');
    writeFile(repo, 'cat2/file2.md');
    const manifest = {
      categories: [
        { name: 'Cat1', sourceDir: 'cat1', targetDir: 'out1', recursive: false },
        { name: 'Cat2', sourceDir: 'cat2', targetDir: 'out2', recursive: false },
      ],
      globalExcludes: [],
    };
    const results = copyAll(manifest, repo, target);
    assert.equal(results.length, 2);
    assert.equal(results[0].category, 'Cat1');
    assert.equal(results[0].success, true);
    assert.equal(results[1].category, 'Cat2');
    assert.equal(results[1].success, true);
    assert.ok(fs.existsSync(path.join(target, 'out1', 'file1.md')));
    assert.ok(fs.existsSync(path.join(target, 'out2', 'file2.md')));
  } finally {
    cleanup();
  }
});

// ── copyAll — globalExcludes merging ─────────────────────────────────────────

test('copyAll merges globalExcludes into each category exclude lists', () => {
  const { repo, target, cleanup } = makeDirs();
  try {
    writeFile(repo, 'src/keep.md');
    writeFile(repo, 'src/skip.md');
    const manifest = {
      categories: [
        { name: 'Test', sourceDir: 'src', targetDir: 'out', recursive: false },
      ],
      globalExcludes: ['skip.md'],
    };
    copyAll(manifest, repo, target);
    assert.ok(fs.existsSync(path.join(target, 'out', 'keep.md')));
    assert.ok(!fs.existsSync(path.join(target, 'out', 'skip.md')));
  } finally {
    cleanup();
  }
});

// ── copyAll — error isolation ─────────────────────────────────────────────────

test('copyAll silently skips missing categories and continues copying present ones', () => {
  const { repo, target, cleanup } = makeDirs();
  try {
    writeFile(repo, 'exists/file.md');
    const manifest = {
      categories: [
        { name: 'Missing', sourceDir: 'nonexistent', targetDir: 'out1', recursive: false },
        { name: 'Exists', sourceDir: 'exists', targetDir: 'out2', recursive: false },
      ],
      globalExcludes: [],
    };
    const results = copyAll(manifest, repo, target);
    assert.equal(results.length, 2);
    assert.equal(results[0].success, true);
    assert.equal(results[0].skipped, true);
    assert.equal(results[0].fileCount, 0);
    assert.equal(results[1].success, true);
    assert.equal(results[1].skipped, undefined);
    assert.ok(fs.existsSync(path.join(target, 'out2', 'file.md')));
  } finally {
    cleanup();
  }
});

// ── End-to-end: orchestration-staging exclusion ───────────────────────────────

test('orchestration-staging/ directory is excluded when copying the Skills category', () => {
  const { repo, target, cleanup } = makeDirs();
  try {
    writeFile(repo, '.github/skills/skill-a/SKILL.md');
    writeFile(repo, '.github/skills/orchestration-staging/STAGING.md');
    writeFile(repo, '.github/skills/global-skill.md');
    const manifest = {
      categories: [
        {
          name: 'Skills',
          sourceDir: '.github/skills',
          targetDir: 'skills',
          recursive: true,
          excludeDirs: ['orchestration-staging'],
        },
      ],
      globalExcludes: ['node_modules', '.next', '.env.local', 'package-lock.json'],
    };
    const results = copyAll(manifest, repo, target);
    assert.equal(results[0].success, true);
    assert.ok(fs.existsSync(path.join(target, 'skills', 'skill-a', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(target, 'skills', 'global-skill.md')));
    assert.ok(!fs.existsSync(path.join(target, 'skills', 'orchestration-staging')));
  } finally {
    cleanup();
  }
});
