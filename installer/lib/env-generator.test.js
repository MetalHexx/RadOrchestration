import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateEnvLocal } from './env-generator.js';

test('basic output format with Windows path and .github orchRoot', () => {
  const result = generateEnvLocal('C:\\Users\\dev\\project', '.github');
  assert.strictEqual(result, 'WORKSPACE_ROOT=C:\\Users\\dev\\project\nORCH_ROOT=.github\n');
});

test('basic output format with Unix path and .github orchRoot', () => {
  const result = generateEnvLocal('/home/user/workspace', '.github');
  assert.strictEqual(result, 'WORKSPACE_ROOT=/home/user/workspace\nORCH_ROOT=.github\n');
});

test('relative orchRoot value is preserved as-is', () => {
  const result = generateEnvLocal('/home/user/ws', '.copilot');
  assert.ok(result.includes('ORCH_ROOT=.copilot'));
});

test('absolute orchRoot path is preserved as-is', () => {
  const result = generateEnvLocal('D:\\Projects\\app', '/shared/orch');
  assert.ok(result.includes('ORCH_ROOT=/shared/orch'));
  assert.ok(result.includes('WORKSPACE_ROOT=D:\\Projects\\app'));
});

test('output always ends with a trailing newline', () => {
  const result = generateEnvLocal('/some/path', '.github');
  assert.ok(result.endsWith('\n'));
});

test('output contains exactly two KEY=value lines plus trailing newline', () => {
  const result = generateEnvLocal('/workspace', '.github');
  const lines = result.split('\n');
  // Split on \n produces 3 elements: line1, line2, '' (trailing newline)
  assert.strictEqual(lines.length, 3);
  assert.strictEqual(lines[2], '');
  assert.match(lines[0], /^[A-Z_]+=.+/);
  assert.match(lines[1], /^[A-Z_]+=.+/);
});

test('no quotes are added around values', () => {
  const result = generateEnvLocal('/home/user/project', '.github');
  assert.ok(!result.includes('"'));
  assert.ok(!result.includes("'"));
});

test('no spaces exist around the = delimiter', () => {
  const result = generateEnvLocal('/home/user/project', '.github');
  assert.ok(!result.includes(' = '));
  assert.ok(!result.includes('= '));
  assert.ok(!result.includes(' ='));
});

test('Windows-style paths are preserved without modification', () => {
  const winPath = 'C:\\Users\\dev\\my-project';
  const result = generateEnvLocal(winPath, '.github');
  assert.ok(result.includes(`WORKSPACE_ROOT=${winPath}`));
});

test('Unix-style paths are preserved without modification', () => {
  const unixPath = '/home/user/project';
  const result = generateEnvLocal(unixPath, '.github');
  assert.ok(result.includes(`WORKSPACE_ROOT=${unixPath}`));
});
