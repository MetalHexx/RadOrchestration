import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installHarness } from './install-harness.js';

let tmp;
let homeOriginal;
let pluginRoot;

const HARNESS = 'claude';
const DELIVERING_VERSION = '1.0.0-alpha.9';
const PRIOR_VERSION = '1.0.0-alpha.7';

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ih-'));
  homeOriginal = os.homedir;
  os.homedir = () => tmp;

  pluginRoot = path.join(tmp, 'bundle');
  // Build a minimal synthetic bundle layout with a single delivering-version
  // manifest entry (the CLI sentinel) and matching source file on disk.
  const cliPath = ['skills', 'rad-orchestration', 'scripts', 'radorch.mjs'];
  fs.mkdirSync(path.join(pluginRoot, ...cliPath.slice(0, -1)), { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, ...cliPath), 'cli-body');

  fs.mkdirSync(path.join(pluginRoot, 'manifests'), { recursive: true });
  const manifest = {
    harness: HARNESS,
    version: DELIVERING_VERSION,
    files: [{
      bundlePath: cliPath.join('/'),
      destinationPath: '${HARNESS_ROOT}/' + cliPath.join('/'),
      sha256: 'fake',
      version: DELIVERING_VERSION,
      harness: HARNESS,
    }],
  };
  fs.writeFileSync(
    path.join(pluginRoot, 'manifests', `v${DELIVERING_VERSION}.json`),
    JSON.stringify(manifest),
  );
  fs.writeFileSync(
    path.join(pluginRoot, 'package.json'),
    JSON.stringify({ name: 'test', version: DELIVERING_VERSION }),
  );
});

afterEach(() => {
  os.homedir = homeOriginal;
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Read the v6 registry written by installHarness. */
function readRegistry() {
  return JSON.parse(fs.readFileSync(path.join(tmp, '.radorch', 'install.json'), 'utf8'));
}

/** Pre-stage a v6 install.json with the given harness entry already present. */
function seedV6Entry(installKey, version, channel = 'legacy-installer', extra = {}) {
  fs.mkdirSync(path.join(tmp, '.radorch'), { recursive: true });
  const existing = fs.existsSync(path.join(tmp, '.radorch', 'install.json'))
    ? readRegistry()
    : { state_schema_version: 'v6', harnesses: {} };
  existing.harnesses[installKey] = {
    version,
    channel,
    installed_at: '2026-01-01T00:00:00.000Z',
    last_writer_version: version,
    ...extra,
  };
  fs.writeFileSync(
    path.join(tmp, '.radorch', 'install.json'),
    JSON.stringify(existing, null, 2) + '\n',
  );
}

/** Pre-stage a v5-shape install.json (single record). */
function seedV5(packageVersion) {
  fs.mkdirSync(path.join(tmp, '.radorch'), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, '.radorch', 'install.json'),
    JSON.stringify({
      package_version: packageVersion,
      installed_at: '2026-01-01T00:00:00.000Z',
      last_writer_version: packageVersion,
      state_schema_version: 'v5',
    }),
  );
}

test('installHarness — fresh-install writes v6 shape with harnesses[claude] entry', async () => {
  const result = await installHarness({ pluginRoot, harness: HARNESS });
  assert.equal(result.action, 'fresh-install');
  assert.equal(result.deliveringVersion, DELIVERING_VERSION);
  const target = path.join(tmp, '.claude', 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs');
  assert.ok(fs.existsSync(target));
  const ij = readRegistry();
  assert.equal(ij.state_schema_version, 'v6');
  assert.ok(ij.harnesses);
  const entry = ij.harnesses.claude;
  assert.ok(entry, 'harnesses.claude should be present');
  assert.equal(entry.version, DELIVERING_VERSION);
  assert.equal(entry.channel, 'legacy-installer');
  assert.equal(entry.last_writer_version, DELIVERING_VERSION);
  assert.ok(entry.installed_at, 'installed_at should be set');
  // base files
  assert.ok(fs.existsSync(path.join(tmp, '.radorch', 'config.yml')));
  assert.ok(fs.existsSync(path.join(tmp, '.radorch', 'registry.yml')));
});

test('installHarness — noop when installed version matches delivering', async () => {
  await installHarness({ pluginRoot, harness: HARNESS });
  const result = await installHarness({ pluginRoot, harness: HARNESS });
  assert.equal(result.action, 'noop');
});

test('installHarness — downgrade-refused when installed > delivering', async () => {
  seedV6Entry('claude', '2.0.0');
  const sentinel = path.join(pluginRoot, 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs');
  assert.ok(fs.existsSync(sentinel));

  const result = await installHarness({ pluginRoot, harness: HARNESS });
  assert.equal(result.action, 'downgrade-refused');
  assert.match(result.message, /refuses to downgrade/);
});

test('installHarness — upgrade-complete preserves installed_at; bumps version + last_writer_version', async () => {
  // Stage prior manifest in catalog.
  const priorManifestFile = path.join(pluginRoot, 'manifests', `v${PRIOR_VERSION}.json`);
  fs.writeFileSync(priorManifestFile, JSON.stringify({
    harness: HARNESS,
    version: PRIOR_VERSION,
    files: [{
      bundlePath: 'agents/old.md',
      destinationPath: '${HARNESS_ROOT}/agents/old.md',
    }],
  }));
  const oldPath = path.join(tmp, '.claude', 'agents', 'old.md');
  fs.mkdirSync(path.dirname(oldPath), { recursive: true });
  fs.writeFileSync(oldPath, 'stale');

  seedV6Entry('claude', PRIOR_VERSION);
  const result = await installHarness({ pluginRoot, harness: HARNESS });
  assert.equal(result.action, 'upgrade-complete');
  assert.ok(!fs.existsSync(oldPath), 'prior agents/old.md must be removed');
  const newCli = path.join(tmp, '.claude', 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs');
  assert.ok(fs.existsSync(newCli));
  const ij = readRegistry();
  const entry = ij.harnesses.claude;
  assert.equal(entry.version, DELIVERING_VERSION);
  assert.equal(entry.last_writer_version, DELIVERING_VERSION);
  assert.equal(entry.installed_at, '2026-01-01T00:00:00.000Z', 'installed_at preserved on upgrade');
});

test('installHarness — graceful degrade when prior manifest missing', async () => {
  seedV6Entry('claude', PRIOR_VERSION);
  const result = await installHarness({ pluginRoot, harness: HARNESS });
  assert.equal(result.action, 'upgrade-complete');
  const ij = readRegistry();
  assert.equal(ij.harnesses.claude.version, DELIVERING_VERSION);
});

test('installHarness — v5 install.json is migrated lazily on first read', async () => {
  // Pre-existing alpha.8 single-record install. After running installer, the
  // file should be v6 with harnesses.claude carrying the new entry.
  seedV5(PRIOR_VERSION);
  const result = await installHarness({ pluginRoot, harness: HARNESS });
  assert.equal(result.action, 'upgrade-complete');
  const ij = readRegistry();
  assert.equal(ij.state_schema_version, 'v6');
  assert.equal(ij.harnesses.claude.version, DELIVERING_VERSION);
  assert.equal(ij.harnesses.claude.channel, 'legacy-installer');
});

test('installHarness — preserves other harness entries on write', async () => {
  // Stage an existing copilot-cli entry. Installing claude must not touch it.
  seedV6Entry('copilot-cli', '1.0.0-alpha.5');
  const result = await installHarness({ pluginRoot, harness: HARNESS });
  assert.equal(result.action, 'fresh-install');
  const ij = readRegistry();
  assert.ok(ij.harnesses['copilot-cli'], 'copilot-cli entry must be preserved');
  assert.equal(ij.harnesses['copilot-cli'].version, '1.0.0-alpha.5');
  assert.ok(ij.harnesses.claude, 'claude entry written');
  assert.equal(ij.harnesses.claude.version, DELIVERING_VERSION);
});

test('installHarness — copilot folder mutex replaces partner entry and logs', async () => {
  // Rebuild plugin to deliver copilot-cli.
  const pluginRoot2 = path.join(tmp, 'bundle-copilot');
  fs.mkdirSync(path.join(pluginRoot2, 'skills', 'rad-orchestration', 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(pluginRoot2, 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs'), 'cli-body');
  fs.mkdirSync(path.join(pluginRoot2, 'manifests'), { recursive: true });
  fs.writeFileSync(
    path.join(pluginRoot2, 'manifests', `v${DELIVERING_VERSION}.json`),
    JSON.stringify({
      harness: 'copilot-cli',
      version: DELIVERING_VERSION,
      files: [{
        bundlePath: 'skills/rad-orchestration/scripts/radorch.mjs',
        destinationPath: '${HARNESS_ROOT}/skills/rad-orchestration/scripts/radorch.mjs',
      }],
    }),
  );
  fs.writeFileSync(path.join(pluginRoot2, 'package.json'), JSON.stringify({ name: 't', version: DELIVERING_VERSION }));

  // Pre-existing copilot-vscode entry — must be replaced by copilot-cli.
  seedV6Entry('copilot-vscode', '1.0.0-alpha.6');

  // Capture stderr.
  const origWrite = process.stderr.write.bind(process.stderr);
  let captured = '';
  process.stderr.write = (chunk) => { captured += String(chunk); return true; };
  try {
    const result = await installHarness({ pluginRoot: pluginRoot2, harness: 'copilot-cli' });
    assert.equal(result.action, 'fresh-install');
  } finally {
    process.stderr.write = origWrite;
  }
  const ij = readRegistry();
  assert.ok(!ij.harnesses['copilot-vscode'], 'copilot-vscode must be removed');
  assert.ok(ij.harnesses['copilot-cli'], 'copilot-cli must be present');
  assert.match(
    captured,
    /Replaced copilot-vscode .* with copilot-cli .* both share ~\/\.copilot\//,
    'mutex notification logged to stderr',
  );
});

test('installHarness — claude install warns when claude-plugin entry present (coexist, no removal)', async () => {
  // Pre-existing claude-plugin entry — must coexist; legacy install just warns.
  seedV6Entry('claude-plugin', '1.0.0-alpha.8', 'plugin');

  const origWrite = process.stderr.write.bind(process.stderr);
  let captured = '';
  process.stderr.write = (chunk) => { captured += String(chunk); return true; };
  try {
    const result = await installHarness({ pluginRoot, harness: 'claude' });
    assert.equal(result.action, 'fresh-install');
  } finally {
    process.stderr.write = origWrite;
  }
  const ij = readRegistry();
  assert.ok(ij.harnesses['claude-plugin'], 'claude-plugin entry preserved');
  assert.ok(ij.harnesses.claude, 'claude entry written');
  assert.match(captured, /Claude Code plugin install of rad-orchestration is already registered/);
  // The recommendation text wraps across a line break; match the slash-prefixed
  // form with arbitrary whitespace tolerated between the two tokens.
  assert.match(captured, /\/plugin uninstall\s+rad-orchestration/);
});
