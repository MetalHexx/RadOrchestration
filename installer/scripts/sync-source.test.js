// installer/scripts/sync-source.test.js — Per-harness bundle emission.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  autoPromoteCommittedManifest,
  emitBundles,
  restoreCommittedManifests,
  syncSource,
} from './sync-source.js';

function makeRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-'));
  // Minimal canonical source.
  fs.mkdirSync(path.join(repo, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'skills', 'rad-x'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, 'agents', 'a.md'),
    '---\nname: a\ndescription: d\nmodel: opus\n---\nbody\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(repo, 'skills', 'rad-x', 'SKILL.md'),
    '---\nname: rad-x\ndescription: d\n---\nbody\n',
    'utf8',
  );
  // Copy the live adapters folder into the temp repo.
  // (Junction symlinks resolve relative to CWD at test time; fs.cpSync is
  // more portable on Windows and avoids path-resolution surprises.)
  const liveAdapters = path.resolve(import.meta.dirname, '../../adapters');
  fs.cpSync(liveAdapters, path.join(repo, 'adapters'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'installer', 'src'), { recursive: true });
  return repo;
}

test('emitBundles writes installer/src/<harness>/ for every adapter', async () => {
  const repo = makeRepo();
  await emitBundles({ repoRoot: repo, version: '0.0.0-test' });
  assert.ok(fs.existsSync(path.join(repo, 'installer', 'src', 'claude', 'agents', 'a.md')));
  assert.ok(fs.existsSync(path.join(repo, 'installer', 'src', 'copilot-vscode', 'agents', 'a.agent.md')));
  assert.ok(fs.existsSync(path.join(repo, 'installer', 'src', 'copilot-cli', 'agents', 'a.agent.md')));
});

test('every emitted bundle carries a per-version manifest in the catalog directory', async () => {
  const repo = makeRepo();
  await emitBundles({ repoRoot: repo, version: '0.0.0-test' });
  for (const harness of ['claude', 'copilot-vscode', 'copilot-cli']) {
    const manifestPath = path.join(repo, 'installer', 'src', harness, 'manifests', 'v0.0.0-test.json');
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(m.harness, harness);
    assert.strictEqual(m.version, '0.0.0-test');
    assert.ok(m.files.length > 0);
  }
});

// ── Helpers for syncSource tests ──────────────────────────────────────────────

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
  } finally {
    cleanup();
  }
});

// ── Excludes filter ───────────────────────────────────────────────────────────

test('excludes specified directories and files when excludes set is provided', () => {
  const { source, target, cleanup } = makeSandbox();
  try {
    writeFile(source, 'keep.txt', 'keep');
    writeFile(source, 'node_modules/pkg/index.js', 'pkg');
    writeFile(source, '.next/build/output.js', 'build');
    writeFile(source, '.env.local', 'secret');
    writeFile(source, 'sub/file.txt', 'sub');

    const excludes = new Set(['node_modules', '.next', '.env.local']);
    syncSource(source, target, excludes);

    assert.ok(fs.existsSync(path.join(target, 'keep.txt')), 'keep.txt should be copied');
    assert.ok(fs.existsSync(path.join(target, 'sub', 'file.txt')), 'sub/file.txt should be copied');
    assert.ok(!fs.existsSync(path.join(target, 'node_modules')), 'node_modules should be excluded');
    assert.ok(!fs.existsSync(path.join(target, '.next')), '.next should be excluded');
    assert.ok(!fs.existsSync(path.join(target, '.env.local')), '.env.local should be excluded');
  } finally {
    cleanup();
  }
});

test('without excludes, all files are copied including node_modules', () => {
  const { source, target, cleanup } = makeSandbox();
  try {
    writeFile(source, 'keep.txt', 'keep');
    writeFile(source, 'node_modules/pkg/index.js', 'pkg');
    syncSource(source, target);

    assert.ok(fs.existsSync(path.join(target, 'keep.txt')), 'keep.txt should be copied');
    assert.ok(fs.existsSync(path.join(target, 'node_modules', 'pkg', 'index.js')), 'node_modules should be copied when no excludes');
  } finally {
    cleanup();
  }
});

// ── Committed-manifest restore + four-case auto-promote ───────────────────────

/**
 * Builds a minimal temp repo with `<repoRoot>/manifests/<harness>/` committed
 * source-of-truth catalogs, plus the runtime location (`installer/src/<harness>/
 * manifests/`) empty. Mirrors the real repo layout closely enough that
 * `restoreCommittedManifests` and `autoPromoteCommittedManifest` exercise their
 * real I/O paths.
 */
function makeRestoreFixture(harnesses = ['claude']) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-fixture-'));
  for (const h of harnesses) {
    fs.mkdirSync(path.join(repo, 'manifests', h), { recursive: true });
    fs.mkdirSync(path.join(repo, 'installer', 'src', h), { recursive: true });
  }
  return repo;
}

test('restoreCommittedManifests copies every committed v*.json into runtime', () => {
  const repo = makeRestoreFixture(['claude']);
  fs.writeFileSync(
    path.join(repo, 'manifests', 'claude', 'v1.0.0-alpha.8.json'),
    '{"harness":"claude","version":"1.0.0-alpha.8","files":[]}',
  );
  fs.writeFileSync(
    path.join(repo, 'manifests', 'claude', 'v1.0.0-alpha.9.json'),
    '{"harness":"claude","version":"1.0.0-alpha.9","files":[]}',
  );
  // README sibling — must not be copied; only v*.json files are restored.
  fs.writeFileSync(path.join(repo, 'manifests', 'claude', 'README.md'), 'x');

  restoreCommittedManifests(repo, 'claude');

  const runtimeDir = path.join(repo, 'installer', 'src', 'claude', 'manifests');
  assert.ok(fs.existsSync(path.join(runtimeDir, 'v1.0.0-alpha.8.json')));
  assert.ok(fs.existsSync(path.join(runtimeDir, 'v1.0.0-alpha.9.json')));
  assert.ok(!fs.existsSync(path.join(runtimeDir, 'README.md')),
    'non-v*.json siblings must not be copied into runtime');
});

test('restoreCommittedManifests is a no-op when <repoRoot>/manifests/<harness>/ does not exist', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-noop-'));
  fs.mkdirSync(path.join(repo, 'installer', 'src', 'claude'), { recursive: true });
  // No <repoRoot>/manifests/ directory. Must not throw.
  restoreCommittedManifests(repo, 'claude');
  const runtimeDir = path.join(repo, 'installer', 'src', 'claude', 'manifests');
  // Either the dir was never created or it's empty — either is acceptable.
  if (fs.existsSync(runtimeDir)) {
    assert.equal(fs.readdirSync(runtimeDir).length, 0);
  }
});

/**
 * Writes a minimal runtime manifest for a given harness/version so the
 * auto-promote function has something to read.
 */
function writeRuntimeManifest(repo, harness, version, body) {
  const dir = path.join(repo, 'installer', 'src', harness, 'manifests');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `v${version}.json`), body);
}

test('autoPromoteCommittedManifest: case 1 — committed does not exist → write', () => {
  const repo = makeRestoreFixture(['claude']);
  const body = '{"harness":"claude","version":"1.0.0-alpha.8","files":[]}';
  writeRuntimeManifest(repo, 'claude', '1.0.0-alpha.8', body);

  const result = autoPromoteCommittedManifest(repo, 'claude', '1.0.0-alpha.8');

  assert.equal(result, 'wrote');
  const committedPath = path.join(repo, 'manifests', 'claude', 'v1.0.0-alpha.8.json');
  assert.ok(fs.existsSync(committedPath));
  assert.equal(fs.readFileSync(committedPath, 'utf8'), body);
});

test('autoPromoteCommittedManifest: case 2 — committed matches runtime → no-op', () => {
  const repo = makeRestoreFixture(['claude']);
  const body = '{"harness":"claude","version":"1.0.0-alpha.8","files":[]}';
  writeRuntimeManifest(repo, 'claude', '1.0.0-alpha.8', body);
  const committedPath = path.join(repo, 'manifests', 'claude', 'v1.0.0-alpha.8.json');
  fs.writeFileSync(committedPath, body);
  const bytesBefore = fs.readFileSync(committedPath);

  const result = autoPromoteCommittedManifest(repo, 'claude', '1.0.0-alpha.8');

  assert.equal(result, 'matches');
  // Byte-level no-op check — mtime granularity varies across filesystems
  // (FAT32: 2s, ReFS: ~1s, NTFS: 100ns), so compare contents directly.
  assert.equal(
    Buffer.compare(bytesBefore, fs.readFileSync(committedPath)),
    0,
    'committed file must be byte-identical when content matches',
  );
});

test('autoPromoteCommittedManifest: case 3 — committed differs → warn, do not overwrite', () => {
  const repo = makeRestoreFixture(['claude']);
  const runtimeBody = '{"harness":"claude","version":"1.0.0-alpha.8","files":[{"bundlePath":"a"}]}';
  writeRuntimeManifest(repo, 'claude', '1.0.0-alpha.8', runtimeBody);
  const committedBody = '{"harness":"claude","version":"1.0.0-alpha.8","files":[{"bundlePath":"b"}]}';
  const committedPath = path.join(repo, 'manifests', 'claude', 'v1.0.0-alpha.8.json');
  fs.writeFileSync(committedPath, committedBody);

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  let result;
  try {
    result = autoPromoteCommittedManifest(repo, 'claude', '1.0.0-alpha.8');
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(result, 'drift-warned');
  assert.equal(fs.readFileSync(committedPath, 'utf8'), committedBody,
    'committed file must not be overwritten when drift is detected');
  assert.ok(
    warnings.some((w) => w.includes('drifted') && w.includes('1.0.0-alpha.8')),
    `expected a drift warning, got: ${JSON.stringify(warnings)}`,
  );
});

test('autoPromoteCommittedManifest: missing runtime → no-op signal', () => {
  const repo = makeRestoreFixture(['claude']);
  // No runtime manifest at all.
  const result = autoPromoteCommittedManifest(repo, 'claude', '1.0.0-alpha.99');
  assert.equal(result, 'missing-runtime');
  assert.ok(
    !fs.existsSync(path.join(repo, 'manifests', 'claude', 'v1.0.0-alpha.99.json')),
    'must not create a committed entry when runtime is missing',
  );
});

test('emitBundles end-to-end: writes runtime manifest AND auto-promotes to <repoRoot>/manifests/<harness>/', async () => {
  const repo = makeRepo();
  await emitBundles({ repoRoot: repo, version: '0.0.0-test' });
  for (const harness of ['claude', 'copilot-vscode', 'copilot-cli']) {
    const runtimePath = path.join(
      repo, 'installer', 'src', harness, 'manifests', 'v0.0.0-test.json',
    );
    const committedPath = path.join(
      repo, 'manifests', harness, 'v0.0.0-test.json',
    );
    assert.ok(fs.existsSync(runtimePath), `${harness} runtime manifest missing`);
    assert.ok(fs.existsSync(committedPath), `${harness} committed manifest missing — auto-promote did not fire`);
    // Byte-level compare mirrors autoPromoteCommittedManifest's own Buffer.compare.
    assert.equal(
      Buffer.compare(fs.readFileSync(runtimePath), fs.readFileSync(committedPath)),
      0,
      `${harness} runtime/committed manifests must be byte-identical after auto-promote`,
    );
  }
});
