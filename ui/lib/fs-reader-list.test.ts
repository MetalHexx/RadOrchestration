/**
 * Tests for listProjectFiles function.
 * Run with: npx tsx ui/lib/fs-reader-list.test.ts
 */
import assert from 'node:assert';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { listProjectFiles, listProjectFilesWithMtimes } from './fs-reader';

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

  await test('skips node_modules / .git / .next / .cache directories', async () => {
    // Scaffold-internal dirs a user-created project might contain once it has
    // its own build output. listProjectFiles must not descend into any of them
    // — otherwise "Other Docs" bloats with node_modules READMEs and the
    // watcher in ui/app/api/events/route.ts hits EPERM + OOM on Windows.
    const nmPkg = path.join(tmpDir, 'node_modules', 'some-pkg');
    const nmNested = path.join(tmpDir, 'node_modules', 'some-pkg', 'nested');
    const gitDir = path.join(tmpDir, '.git');
    const nextDir = path.join(tmpDir, '.next', 'static');
    const cacheDir = path.join(tmpDir, '.cache');
    await mkdir(nmNested, { recursive: true });
    await mkdir(gitDir, { recursive: true });
    await mkdir(nextDir, { recursive: true });
    await mkdir(cacheDir, { recursive: true });
    await writeFile(path.join(nmPkg, 'README.md'), '# pkg');
    await writeFile(path.join(nmNested, 'CHANGELOG.md'), '# nested');
    await writeFile(path.join(gitDir, 'NOTES.md'), '# git');
    await writeFile(path.join(nextDir, 'build.md'), '# next');
    await writeFile(path.join(cacheDir, 'blob.md'), '# cache');

    const files = await listProjectFiles(tmpDir);

    for (const f of files) {
      assert.ok(
        !f.startsWith('node_modules/'),
        `should skip node_modules, saw "${f}"`,
      );
      assert.ok(!f.startsWith('.git/'), `should skip .git, saw "${f}"`);
      assert.ok(!f.startsWith('.next/'), `should skip .next, saw "${f}"`);
      assert.ok(!f.startsWith('.cache/'), `should skip .cache, saw "${f}"`);
    }
    // Sanity: the root-level .md files from setup() must still appear.
    assert.ok(files.includes('PRD.md'), 'should still include PRD.md');

    await rm(path.join(tmpDir, 'node_modules'), { recursive: true });
    await rm(gitDir, { recursive: true });
    await rm(path.join(tmpDir, '.next'), { recursive: true });
    await rm(cacheDir, { recursive: true });
  });

  await test('returns root *.html files alongside .md (FR-22)', async () => {
    await writeFile(path.join(tmpDir, 'DEMO-BRAINSTORM.html'), '<html></html>');
    await writeFile(path.join(tmpDir, 'DEMO-WIREFRAME-LAUNCH-SCREEN.html'), '<html></html>');
    const files = await listProjectFiles(tmpDir);
    assert.ok(files.includes('DEMO-BRAINSTORM.html'), 'should include root brainstorm html');
    assert.ok(files.includes('DEMO-WIREFRAME-LAUNCH-SCREEN.html'), 'should include root wireframe html');
  });

  await test('still returns .md files after html extension (AD-3)', async () => {
    const files = await listProjectFiles(tmpDir);
    assert.ok(files.includes('PRD.md'), 'md walk preserved');
    assert.ok(files.includes('tasks/TASK-P01-T01.md'), 'subdir md walk preserved');
  });

  await test('skips html inside ignored directories (AD-3)', async () => {
    await mkdir(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
    await writeFile(path.join(tmpDir, 'node_modules', 'pkg', 'index.html'), '<html></html>');
    const files = await listProjectFiles(tmpDir);
    assert.ok(!files.some((f) => f.includes('node_modules')), 'node_modules html excluded');
  });

  // ─── listProjectFilesWithMtimes tests (FR-2) ────────────────────────────────
  console.log('\nlistProjectFilesWithMtimes');

  await test('returns files and mtimes with numeric entry for each file (FR-2)', async () => {
    const { utimes } = await import('node:fs/promises');
    const dir = await mkdtemp(path.join(os.tmpdir(), 'fs-reader-mtimes-test-'));
    try {
      const firstHtml = path.join(dir, 'PROJ-WIREFRAME-FIRST.html');
      const secondHtml = path.join(dir, 'PROJ-WIREFRAME-SECOND.html');
      await writeFile(firstHtml, '<html>first</html>');
      await writeFile(secondHtml, '<html>second</html>');
      // Set deterministic mtimes: first file older, second file newer
      const oldTime = new Date('2024-01-01T00:00:00Z');
      const newTime = new Date('2024-06-01T00:00:00Z');
      await utimes(firstHtml, oldTime, oldTime);
      await utimes(secondHtml, newTime, newTime);

      const result = await listProjectFilesWithMtimes(dir);

      assert.ok(result.files.includes('PROJ-WIREFRAME-FIRST.html'), 'files includes first html');
      assert.ok(result.files.includes('PROJ-WIREFRAME-SECOND.html'), 'files includes second html');
      assert.ok(typeof result.mtimes['PROJ-WIREFRAME-FIRST.html'] === 'number', 'mtimes has numeric entry for first file');
      assert.ok(typeof result.mtimes['PROJ-WIREFRAME-SECOND.html'] === 'number', 'mtimes has numeric entry for second file');
      assert.ok(
        result.mtimes['PROJ-WIREFRAME-SECOND.html'] > result.mtimes['PROJ-WIREFRAME-FIRST.html'],
        `later-modified file mtime (${result.mtimes['PROJ-WIREFRAME-SECOND.html']}) must exceed earlier one (${result.mtimes['PROJ-WIREFRAME-FIRST.html']})`
      );
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  // Cleanup
  await rm(tmpDir, { recursive: true });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
