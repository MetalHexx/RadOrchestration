// scripts/build.test.js — Build CLI argument parsing + adapter selection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBuildArgs, selectAdapters } from './build.js';

test('parseBuildArgs defaults to harness=claude when no flags', () => {
  assert.deepStrictEqual(parseBuildArgs([]), { harness: 'claude', all: false });
});

test('parseBuildArgs accepts --harness=copilot-vscode', () => {
  assert.deepStrictEqual(parseBuildArgs(['--harness=copilot-vscode']), {
    harness: 'copilot-vscode',
    all: false,
  });
});

test('parseBuildArgs accepts --all (overrides --harness)', () => {
  assert.deepStrictEqual(parseBuildArgs(['--all']), { harness: null, all: true });
});

test('selectAdapters with all=true returns every discovered adapter', () => {
  const all = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
  assert.deepStrictEqual(selectAdapters(all, { all: true, harness: null }), all);
});

test('selectAdapters with harness=name returns only that adapter', () => {
  const all = [{ name: 'a' }, { name: 'b' }];
  assert.deepStrictEqual(selectAdapters(all, { all: false, harness: 'b' }), [{ name: 'b' }]);
});

test('selectAdapters throws when harness is unknown', () => {
  const all = [{ name: 'a' }];
  assert.throws(() => selectAdapters(all, { all: false, harness: 'zzz' }), /Unknown harness/);
});
