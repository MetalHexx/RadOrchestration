import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('repo-root .github/plugin/marketplace.json advertises the plugin under FR-34 name with strict: true and source: github (FR-33, FR-34, FR-35, AD-15, DD-7)', () => {
  const file = path.join(REPO_ROOT, '.github/plugin/marketplace.json');
  assert.ok(fs.existsSync(file), 'marketplace catalog exists at repo root');
  const cat = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(Array.isArray(cat.plugins), 'plugins array present');
  const entry = cat.plugins.find((p) => p.name === 'rad-orc');
  assert.ok(entry, 'plugin listed under FR-34 name');
  assert.strictEqual(entry.strict, true, 'strict mode (FR-35)');
  // AD-15: source is the structured source: github object (only form attested in live marketplaces).
  assert.strictEqual(entry.source.source, 'github', 'source.source is github per AD-15');
  assert.strictEqual(entry.source.repo, 'MetalHexx/RadOrchestration', 'repo points at this repo');
  assert.ok(typeof entry.source.ref === 'string' && entry.source.ref.length > 0, 'ref present');
  assert.ok(typeof entry.source.path === 'string', 'path present');
});

test('the existing .claude-plugin/marketplace.json is unchanged (AD-14)', () => {
  const claudeCat = path.join(REPO_ROOT, '.claude-plugin/marketplace.json');
  assert.ok(fs.existsSync(claudeCat), 'claude catalog still present');
  const cat = JSON.parse(fs.readFileSync(claudeCat, 'utf8'));
  assert.ok(cat.plugins.every((p) => !p.name.includes('copilot-cli')),
    'claude catalog does not list copilot-cli plugin');
});
