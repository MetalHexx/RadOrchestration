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

test('installHarness — fresh-install when install.json absent', async () => {
  const result = await installHarness({ pluginRoot, harness: HARNESS });
  assert.equal(result.action, 'fresh-install');
  assert.equal(result.deliveringVersion, DELIVERING_VERSION);
  const target = path.join(tmp, '.claude', 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs');
  assert.ok(fs.existsSync(target));
  const ij = JSON.parse(fs.readFileSync(path.join(tmp, '.radorch', 'install.json'), 'utf8'));
  assert.equal(ij.package_version, DELIVERING_VERSION);
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
  fs.mkdirSync(path.join(tmp, '.radorch'), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, '.radorch', 'install.json'),
    JSON.stringify({
      package_version: '2.0.0',
      installed_at: '2026-01-01',
      last_writer_version: '2.0.0',
      state_schema_version: 'v5',
    }),
  );
  // Need sentinel for non-fresh path.
  const sentinel = path.join(pluginRoot, 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs');
  assert.ok(fs.existsSync(sentinel));

  const result = await installHarness({ pluginRoot, harness: HARNESS });
  assert.equal(result.action, 'downgrade-refused');
  assert.match(result.message, /refuses to downgrade/);
});

test('installHarness — upgrade-complete when prior < delivering and prior manifest present', async () => {
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
  // Create a stale prior-version file on the user's disk.
  const oldPath = path.join(tmp, '.claude', 'agents', 'old.md');
  fs.mkdirSync(path.dirname(oldPath), { recursive: true });
  fs.writeFileSync(oldPath, 'stale');

  // Stage install.json pointing to prior version + the sentinel on the
  // pluginRoot bundle (so the install-harness state machine knows this is upgrade).
  fs.mkdirSync(path.join(tmp, '.radorch'), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, '.radorch', 'install.json'),
    JSON.stringify({
      package_version: PRIOR_VERSION,
      installed_at: '2026-01-01',
      last_writer_version: PRIOR_VERSION,
      state_schema_version: 'v5',
    }),
  );

  const result = await installHarness({ pluginRoot, harness: HARNESS });
  assert.equal(result.action, 'upgrade-complete');
  // Stale prior-version file removed; new delivering version installed.
  assert.ok(!fs.existsSync(oldPath), 'prior agents/old.md must be removed');
  const newCli = path.join(tmp, '.claude', 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs');
  assert.ok(fs.existsSync(newCli));
  const ij = JSON.parse(fs.readFileSync(path.join(tmp, '.radorch', 'install.json'), 'utf8'));
  assert.equal(ij.package_version, DELIVERING_VERSION);
});

test('installHarness — graceful degrade when prior manifest missing', async () => {
  // install.json says alpha.7 but catalog has no v1.0.0-alpha.7 manifest.
  fs.mkdirSync(path.join(tmp, '.radorch'), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, '.radorch', 'install.json'),
    JSON.stringify({
      package_version: PRIOR_VERSION,
      installed_at: '2026-01-01',
      last_writer_version: PRIOR_VERSION,
      state_schema_version: 'v5',
    }),
  );

  const result = await installHarness({ pluginRoot, harness: HARNESS });
  // Still completes the upgrade; prior orphans may remain but the new version
  // is installed and install.json is updated.
  assert.equal(result.action, 'upgrade-complete');
  const ij = JSON.parse(fs.readFileSync(path.join(tmp, '.radorch', 'install.json'), 'utf8'));
  assert.equal(ij.package_version, DELIVERING_VERSION);
});
