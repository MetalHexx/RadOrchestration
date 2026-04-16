// installer/lib/manifest.test.js — Tests for manifest.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getManifest } from './manifest.js';

// ── Return shape ──────────────────────────────────────────────────────────────

test('getManifest returns object with categories array and globalExcludes array', () => {
  const manifest = getManifest('.github');
  assert.ok(manifest !== null && typeof manifest === 'object');
  assert.ok(Array.isArray(manifest.categories));
  assert.ok(Array.isArray(manifest.globalExcludes));
});

// ── Category count ────────────────────────────────────────────────────────────

test('getManifest returns exactly 3 categories', () => {
  const { categories } = getManifest('.github');
  assert.strictEqual(categories.length, 3);
});

// ── Category names and order ──────────────────────────────────────────────────

test('category names are in correct order', () => {
  const { categories } = getManifest('.github');
  const names = categories.map(c => c.name);
  assert.deepStrictEqual(names, [
    'Root config',
    'Agents',
    'Skills',
  ]);
});

// ── Root config category ──────────────────────────────────────────────────────

test('Root config category has correct sourceDir, targetDir, and recursive', () => {
  const { categories } = getManifest('.github');
  const cat = categories[0];
  assert.strictEqual(cat.sourceDir, 'src/.claude');
  assert.strictEqual(cat.targetDir, '.');
  assert.strictEqual(cat.recursive, false);
});

// ── Agents category ───────────────────────────────────────────────────────────

test('Agents category has correct sourceDir, targetDir, and recursive', () => {
  const { categories } = getManifest('.github');
  const cat = categories[1];
  assert.strictEqual(cat.sourceDir, 'src/.claude/agents');
  assert.strictEqual(cat.targetDir, 'agents');
  assert.strictEqual(cat.recursive, false);
});

// ── Skills category ───────────────────────────────────────────────────────────

test('Skills category has correct sourceDir, targetDir, recursive, and excludeDirs', () => {
  const { categories } = getManifest('.github');
  const cat = categories[2];
  assert.strictEqual(cat.sourceDir, 'src/.claude/skills');
  assert.strictEqual(cat.targetDir, 'skills');
  assert.strictEqual(cat.recursive, true);
  assert.deepStrictEqual(cat.excludeDirs, ['orchestration-staging']);
});

// ── globalExcludes ────────────────────────────────────────────────────────────

test('globalExcludes matches expected array', () => {
  const { globalExcludes } = getManifest('.github');
  assert.deepStrictEqual(globalExcludes, [
    'node_modules',
    '.next',
    '.env.local',
    'package-lock.json',
  ]);
});

// ── Parameterization ──────────────────────────────────────────────────────────

test('getManifest sourceDir values are decoupled from orchRoot parameter', () => {
  const { categories } = getManifest('custom-root');
  // sourceDir is always src/.claude/... regardless of orchRoot
  assert.strictEqual(categories[0].sourceDir, 'src/.claude');
  assert.strictEqual(categories[1].sourceDir, 'src/.claude/agents');
  assert.strictEqual(categories[2].sourceDir, 'src/.claude/skills');
});

// ── No missing required properties ───────────────────────────────────────────

test('no category has undefined or missing name, sourceDir, or targetDir', () => {
  const { categories } = getManifest('.github');
  for (const cat of categories) {
    assert.ok(typeof cat.name === 'string' && cat.name.length > 0, `name missing in ${JSON.stringify(cat)}`);
    assert.ok(typeof cat.sourceDir === 'string' && cat.sourceDir.length > 0, `sourceDir missing in ${cat.name}`);
    assert.ok(typeof cat.targetDir === 'string', `targetDir missing in ${cat.name}`);
  }
});
