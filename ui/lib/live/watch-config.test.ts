import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SETTLE_WINDOW_MS, buildWatchOptions, isIgnoredPath } from './watch-config';

test('settle window is ~0.5s, distinct from the route 0.2s threshold', () => {
  assert.equal(SETTLE_WINDOW_MS, 500);
});

test('ignores heavy directories on POSIX and Windows separators', () => {
  for (const dir of ['node_modules', '.git', '.next', '.cache', 'backups']) {
    assert.equal(isIgnoredPath(`/projects/X/${dir}/foo`), true, dir);
    assert.equal(isIgnoredPath(`C:\\projects\\X\\${dir}\\foo`), true, dir);
  }
  assert.equal(isIgnoredPath('/projects/X/DEMO-BRAINSTORMING.md'), false);
});

test('watch options watch a directory natively with awaitWriteFinish, no glob', () => {
  const opts = buildWatchOptions(false);
  assert.equal(opts.awaitWriteFinish.stabilityThreshold, SETTLE_WINDOW_MS);
  assert.equal(opts.ignoreInitial, true);
  assert.equal(typeof opts.ignored, 'function');
});

test('chokidar dependency is v4', () => {
  const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
  assert.match(pkg.dependencies.chokidar, /^\^?4\./);
});
