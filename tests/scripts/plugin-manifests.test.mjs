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
  assert.ok(typeof p0.source === 'object', 'source must be an object');
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

test('marketplace.json declares the npm source type pointing at @rad-orchestration/claude-plugin', () => {
  const f = path.join(repoRoot, '.claude-plugin', 'marketplace.json');
  const obj = JSON.parse(fs.readFileSync(f, 'utf8'));
  const plugin = obj.plugins[0];
  assert.equal(plugin.source.source, 'npm');
  assert.equal(plugin.source.package, '@rad-orchestration/claude-plugin');
  assert.ok(!('url' in plugin.source), 'npm-source plugin must not carry a url field');
  assert.ok(!('path' in plugin.source), 'npm-source plugin must not carry a path field');
});

// --- P01-T03: narrowed plugin manifest assertions ---

const claudeDist = path.join(repoRoot, 'cli', 'dist', 'marketplaces', 'claude', 'plugins', 'rad-orchestration');
const manifestsDir = path.join(claudeDist, 'manifests');
const SHA256_RE = /^[a-f0-9]{64}$/;

test('plugin manifest excludes agents/* and skills/* entries', () => {
  if (!fs.existsSync(manifestsDir)) return;
  const files = fs.readdirSync(manifestsDir).filter(f => /^v.*\.json$/.test(f));
  for (const f of files) {
    const m = JSON.parse(fs.readFileSync(path.join(manifestsDir, f), 'utf8'));
    // skills/rad-orchestration/scripts/pipeline.js is the sole allowed skills/* entry
    // because it is a shared user-data binary routed into ~/.radorch/ by the bootstrap.
    const leaks = m.files.filter(e =>
      (e.bundlePath.startsWith('agents/') || e.bundlePath.startsWith('skills/')) &&
      e.bundlePath !== 'skills/rad-orchestration/scripts/pipeline.js',
    );
    assert.deepEqual(leaks, [], `${f}: agents/* or skills/* leaked into plugin manifest`);
  }
});

test('plugin manifest lists shared user-data assets with sha256', () => {
  if (!fs.existsSync(manifestsDir)) return;
  const f = fs.readdirSync(manifestsDir).filter(x => /^v.*\.json$/.test(x))[0];
  const m = JSON.parse(fs.readFileSync(path.join(manifestsDir, f), 'utf8'));
  const required = [
    'bin/radorch.mjs',
    'orchestration.yml',
    'skills/rad-orchestration/scripts/pipeline.js',
  ];
  for (const bp of required) {
    const e = m.files.find(x => x.bundlePath === bp);
    assert.ok(e, `plugin manifest missing ${bp}`);
    assert.match(e.sha256, SHA256_RE, `${bp} sha256 missing or malformed`);
  }
  const uiEntries = m.files.filter(e => e.bundlePath.startsWith('ui/'));
  assert.ok(uiEntries.length > 0, 'plugin manifest missing ui/** entries');
  const templateEntries = m.files.filter(e => e.bundlePath.startsWith('templates/'));
  assert.ok(templateEntries.length > 0, 'plugin manifest missing templates/** entries');
});

test('plugin payload contains pre-built dashboard UI', () => {
  const uiRoot = path.join(claudeDist, 'ui');
  assert.ok(fs.existsSync(uiRoot), 'plugin ui/ not built');
  // Next.js standalone produces server.js at the top level.
  assert.ok(
    fs.existsSync(path.join(uiRoot, 'server.js')) || fs.existsSync(path.join(uiRoot, 'ui', 'server.js')),
    'plugin ui/ missing standalone server entry',
  );
});

test('hooks/hooks.json hardcodes --harness claude', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(repoRoot, 'hooks', 'hooks.json'), 'utf8'));
  const text = JSON.stringify(hooks);
  assert.match(text, /--harness\s+claude/, 'plugin SessionStart hook must hardcode --harness claude (AD-12)');
});
