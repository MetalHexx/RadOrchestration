import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const RESERVED = ['claude-plugins-official', 'anthropic-plugins', 'agent-skills'];

test('marketplace.json exists at the discovery location and points at the plugin folder', () => {
  const f = path.join(repoRoot, '.claude-plugin', 'marketplace.json');
  assert.ok(fs.existsSync(f), `${f} must exist`);
  const m = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(typeof m.name, 'string');
  assert.ok(!RESERVED.includes(m.name), `marketplace name "${m.name}" is reserved`);
  assert.equal(m.owner?.name, 'metalhexx');
  assert.ok(Array.isArray(m.plugins) && m.plugins.length === 1);
  const p0 = m.plugins[0];
  assert.equal(p0.name, 'rad-orchestration');
  assert.equal(p0.source, '../marketplace/plugins/rad-orchestration');
});

test('plugin.json exists at the plugin source location with required fields', () => {
  const f = path.join(repoRoot, 'plugin', '.claude-plugin', 'plugin.json');
  assert.ok(fs.existsSync(f), `${f} must exist`);
  const p = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(p.name, 'rad-orchestration');
  assert.ok(typeof p.description === 'string' && p.description.length > 0);
  assert.match(p.version, /^\d+\.\d+\.\d+/);
  assert.equal(p.repository, 'https://github.com/MetalHexx/RadOrchestration');
  assert.equal(typeof p.license, 'string');
  assert.ok(Array.isArray(p.keywords) && p.keywords.includes('orchestration'));
  assert.ok(typeof p.homepage === 'string');
  assert.ok(typeof p.author === 'string' || typeof p.author === 'object');
  // Iter-1.1 scope: no agents declarations (AD-13), no mcpServers
  assert.equal(p.agents, undefined);
  assert.equal(p.mcpServers, undefined);
  // skills + hooks arrays present (filled by build) — accept array or undefined here
  if (p.skills !== undefined) assert.ok(Array.isArray(p.skills));
  if (p.hooks !== undefined) assert.ok(Array.isArray(p.hooks));
});
