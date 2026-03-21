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

test('getManifest returns exactly 6 categories', () => {
  const { categories } = getManifest('.github');
  assert.strictEqual(categories.length, 6);
});

// ── Category names and order ──────────────────────────────────────────────────

test('category names are in correct order', () => {
  const { categories } = getManifest('.github');
  const names = categories.map(c => c.name);
  assert.deepStrictEqual(names, [
    'Root config',
    'Agents',
    'Instructions',
    'Prompts',
    'Hooks',
    'Skills',
  ]);
});

// ── Root config category ──────────────────────────────────────────────────────

test('Root config category has correct sourceDir, targetDir, and recursive', () => {
  const { categories } = getManifest('.github');
  const cat = categories[0];
  assert.strictEqual(cat.sourceDir, 'src/.github');
  assert.strictEqual(cat.targetDir, '.');
  assert.strictEqual(cat.recursive, false);
});

// ── Agents category ───────────────────────────────────────────────────────────

test('Agents category has correct sourceDir, targetDir, and recursive', () => {
  const { categories } = getManifest('.github');
  const cat = categories[1];
  assert.strictEqual(cat.sourceDir, 'src/.github/agents');
  assert.strictEqual(cat.targetDir, 'agents');
  assert.strictEqual(cat.recursive, false);
});

// ── Instructions category ─────────────────────────────────────────────────────

test('Instructions category has correct sourceDir, targetDir, and recursive', () => {
  const { categories } = getManifest('.github');
  const cat = categories[2];
  assert.strictEqual(cat.sourceDir, 'src/.github/instructions');
  assert.strictEqual(cat.targetDir, 'instructions');
  assert.strictEqual(cat.recursive, false);
});

// ── Prompts category ──────────────────────────────────────────────────────────

test('Prompts category has correct sourceDir, targetDir, and recursive', () => {
  const { categories } = getManifest('.github');
  const cat = categories[3];
  assert.strictEqual(cat.sourceDir, 'src/.github/prompts');
  assert.strictEqual(cat.targetDir, 'prompts');
  assert.strictEqual(cat.recursive, false);
});

// ── Hooks category ────────────────────────────────────────────────────────────

test('Hooks category has correct sourceDir, targetDir, and recursive', () => {
  const { categories } = getManifest('.github');
  const cat = categories[4];
  assert.strictEqual(cat.sourceDir, 'src/.github/hooks');
  assert.strictEqual(cat.targetDir, 'hooks');
  assert.strictEqual(cat.recursive, false);
});

// ── Skills category ───────────────────────────────────────────────────────────

test('Skills category has correct sourceDir, targetDir, recursive, and excludeDirs', () => {
  const { categories } = getManifest('.github');
  const cat = categories[5];
  assert.strictEqual(cat.sourceDir, 'src/.github/skills');
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
  // sourceDir is always src/.github/... regardless of orchRoot
  assert.strictEqual(categories[0].sourceDir, 'src/.github');
  assert.strictEqual(categories[1].sourceDir, 'src/.github/agents');
  assert.strictEqual(categories[2].sourceDir, 'src/.github/instructions');
  assert.strictEqual(categories[3].sourceDir, 'src/.github/prompts');
  assert.strictEqual(categories[4].sourceDir, 'src/.github/hooks');
  assert.strictEqual(categories[5].sourceDir, 'src/.github/skills');
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
