import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('repo-root .github/plugin/marketplace.json lists both rad-orc (CLI) and rad-orc-vscode entries with structured source: github objects (FR-35, FR-36, AD-14, AD-15, DD-7)', () => {
  const file = path.join(REPO_ROOT, '.github/plugin/marketplace.json');
  assert.ok(fs.existsSync(file), 'marketplace catalog exists at repo root');
  const cat = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(cat.name, 'rad-orc-marketplace', 'marketplace top-level name unchanged');
  assert.ok(Array.isArray(cat.plugins), 'plugins array present');
  assert.strictEqual(cat.plugins.length, 2, 'two plugin entries (existing rad-orc + new rad-orc-vscode)');

  const cli = cat.plugins.find((p) => p.name === 'rad-orc');
  assert.ok(cli, 'existing rad-orc (CLI plugin) entry preserved');
  assert.strictEqual(cli.strict, true);
  assert.strictEqual(cli.source.source, 'github');

  const vscode = cat.plugins.find((p) => p.name === 'rad-orc-vscode');
  assert.ok(vscode, 'new rad-orc-vscode entry present');
  assert.strictEqual(vscode.strict, true, 'strict mode (FR-36)');
  assert.strictEqual(vscode.source.source, 'github', 'source.source is github per AD-15');
  assert.strictEqual(vscode.source.repo, 'MetalHexx/RadOrchestration');
  assert.ok(typeof vscode.source.ref === 'string' && vscode.source.ref.length > 0);
  assert.ok(typeof vscode.source.path === 'string');
  assert.ok(/vs.?code|resolver|model/i.test(vscode.description), 'description differentiates the VS Code entry from the CLI entry');
});

test('.claude-plugin/marketplace.json is unchanged and does not list any copilot-vscode plugin (AD-14)', () => {
  const claudeCat = path.join(REPO_ROOT, '.claude-plugin/marketplace.json');
  if (!fs.existsSync(claudeCat)) return; // tolerated absence on minimal checkouts
  const cat = JSON.parse(fs.readFileSync(claudeCat, 'utf8'));
  assert.ok(cat.plugins.every((p) => !p.name.includes('copilot-vscode') && !p.name.includes('vscode')),
    'claude catalog does not list copilot-vscode plugin');
});
