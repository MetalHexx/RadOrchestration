/**
 * Tests for listProjectFiles function.
 * Run with: npx tsx ui/lib/fs-reader-list.test.ts
 */
import assert from 'node:assert';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { listProjectFiles } from './fs-reader';

let passed = 0;
let failed = 0;
let tmpDir = '';

async function setup(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fs-reader-test-'));
  // Root-level .md files
  await writeFile(path.join(dir, 'PRD.md'), '# PRD');
  await writeFile(path.join(dir, 'DESIGN.md'), '# Design');
  // Non-.md files
  await writeFile(path.join(dir, 'state.json'), '{}');
  await writeFile(path.join(dir, 'image.png'), 'binary');
  // Subdirectory with .md files
  await mkdir(path.join(dir, 'tasks'));
  await writeFile(path.join(dir, 'tasks', 'TASK-P01-T01.md'), '# Task');
  await writeFile(path.join(dir, 'tasks', 'TASK-P01-T02.md'), '# Task 2');
  // Another subdirectory
  await mkdir(path.join(dir, 'phases'));
  await writeFile(path.join(dir, 'phases', 'PHASE-01.md'), '# Phase');
  // Nested subdirectory
  await mkdir(path.join(dir, 'reports'));
  await writeFile(path.join(dir, 'reports', 'REPORT.md'), '# Report');
  return dir;
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`);
    failed++;
  }
}

async function run() {
  tmpDir = await setup();

  console.log('listProjectFiles');

  await test('returns .md files from the project root directory', async () => {
    const files = await listProjectFiles(tmpDir);
    assert.ok(files.includes('PRD.md'), 'should include PRD.md');
    assert.ok(files.includes('DESIGN.md'), 'should include DESIGN.md');
  });

  await test('returns .md files from subdirectories with forward-slash relative paths', async () => {
    const files = await listProjectFiles(tmpDir);
    assert.ok(files.includes('tasks/TASK-P01-T01.md'), 'should include tasks/TASK-P01-T01.md');
    assert.ok(files.includes('tasks/TASK-P01-T02.md'), 'should include tasks/TASK-P01-T02.md');
    assert.ok(files.includes('phases/PHASE-01.md'), 'should include phases/PHASE-01.md');
    assert.ok(files.includes('reports/REPORT.md'), 'should include reports/REPORT.md');
  });

  await test('excludes non-.md files', async () => {
    const files = await listProjectFiles(tmpDir);
    const hasJson = files.some(f => f.endsWith('.json'));
    const hasPng = files.some(f => f.endsWith('.png'));
    assert.ok(!hasJson, 'should not include .json files');
    assert.ok(!hasPng, 'should not include .png files');
  });

  await test('throws ENOENT for a non-existent directory', async () => {
    try {
      await listProjectFiles(path.join(tmpDir, 'nonexistent'));
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof Error);
      assert.strictEqual((err as NodeJS.ErrnoException).code, 'ENOENT');
    }
  });

  await test('skips entries containing ".." in the name', async () => {
    // Create a directory entry with .. in the name (unusual but for safety testing)
    const weirdDir = path.join(tmpDir, 'a..b');
    await mkdir(weirdDir);
    await writeFile(path.join(weirdDir, 'EVIL.md'), '# evil');

    const files = await listProjectFiles(tmpDir);
    const hasEvil = files.some(f => f.includes('EVIL.md'));
    assert.ok(!hasEvil, 'should skip entries with ".." in the name');

    await rm(weirdDir, { recursive: true });
  });

  await test('uses forward slashes even on Windows', async () => {
    const files = await listProjectFiles(tmpDir);
    for (const f of files) {
      assert.ok(!f.includes('\\'), `path "${f}" should not contain backslashes`);
    }
  });

  // Cleanup
  await rm(tmpDir, { recursive: true });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
