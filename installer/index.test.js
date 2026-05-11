// installer/index.test.js — End-to-end installer integration tests (FR-1, FR-21, NFR-1).
//
// These tests stub a fake home directory via process.env.HOME (POSIX) and
// process.env.USERPROFILE (Windows). os.homedir() honors either, and the
// CLI upgrade primitives compute every canonical path off os.homedir(), so
// nothing else needs to be mocked for the installer to write into the tmp
// sandbox.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { main as installerMain } from './index.js';
import { runPluginBootstrap } from './lib/cli-upgrade-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Locate the bundled plugin payload the installer ships. The bundle is produced
 * by `installer/scripts/sync-source.js` into `installer/src/<harness>/`. If it
 * does not exist (CI / fresh worktree), the tests are skipped — these are
 * integration-shaped and assume the build has run.
 */
function pluginRootFor(harness) {
  const harnessDir = harness === 'claude'
    ? 'claude'
    : harness === 'copilot-vscode'
      ? 'copilot-vscode'
      : 'copilot-cli';
  return path.join(__dirname, 'src', harnessDir);
}

function pluginRootAvailable(harness) {
  const root = pluginRootFor(harness);
  return fs.existsSync(path.join(root, 'package.json'))
    && fs.existsSync(path.join(root, 'manifests'));
}

/**
 * Snapshot every file under a directory tree as { relPath: sha256 }.
 * Used for structural-equivalence comparison between installer and
 * plugin-bootstrap installs.
 */
function snapshotTree(root) {
  const out = {};
  if (!fs.existsSync(root)) return out;
  const walk = (rel) => {
    const abs = path.join(root, rel);
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const childRel = path.join(rel, entry.name);
      const childAbs = path.join(abs, entry.name);
      if (entry.isDirectory()) {
        walk(childRel);
      } else if (entry.isFile()) {
        const bytes = fs.readFileSync(childAbs);
        out[childRel.split(path.sep).join('/')] = crypto.createHash('sha256').update(bytes).digest('hex');
      }
    }
  };
  walk('');
  return out;
}

/** Set up a fresh tmp HOME for one test. */
function withTempHome(t) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-int-'));
  const priorHome = process.env.HOME;
  const priorUserProfile = process.env.USERPROFILE;
  process.env.HOME = tmp;
  process.env.USERPROFILE = tmp;
  t.after(() => {
    if (priorHome === undefined) delete process.env.HOME;
    else process.env.HOME = priorHome;
    if (priorUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = priorUserProfile;
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
  });
  return tmp;
}

test('end-to-end install writes to ~/.radorch and harness folder only', async (t) => {
  if (!pluginRootAvailable('claude')) {
    t.skip('installer/src/claude/ not built; run installer/scripts/sync-source.js first');
    return;
  }
  const tmp = withTempHome(t);

  const priorArgv = process.argv;
  process.argv = ['node', 'index.js', '--yes', '--harness', 'claude'];
  try {
    await installerMain();
  } finally {
    process.argv = priorArgv;
  }

  // ~/.radorch layout
  assert.ok(fs.existsSync(path.join(tmp, '.radorch', 'install.json')),
    '~/.radorch/install.json should be written');
  assert.ok(fs.existsSync(path.join(tmp, '.radorch', 'orchestration.yml')),
    '~/.radorch/orchestration.yml should be written');
  assert.ok(fs.existsSync(path.join(tmp, '.radorch', 'projects')),
    '~/.radorch/projects/ should exist');
  // Harness folder
  assert.ok(fs.existsSync(path.join(tmp, '.claude', 'agents', 'planner.md')),
    '~/.claude/agents/planner.md should exist');
  assert.ok(fs.existsSync(path.join(tmp, '.claude', 'skills', 'rad-orchestration', 'SKILL.md')),
    '~/.claude/skills/rad-orchestration/SKILL.md should exist');
});

test('installer produces structurally-equivalent state vs plugin-bootstrap', async (t) => {
  // Pragmatic substitute for the byte-identical assertion (per handoff
  // Execution Notes): we cannot get byte-for-byte equality because
  // install.json carries `installed_at: new Date().toISOString()` which
  // differs per run. We therefore assert structural equivalence — the same
  // set of files at the same relative paths, with matching content for every
  // entry EXCEPT install.json (compared structurally, ignoring timestamps).
  if (!pluginRootAvailable('claude')) {
    t.skip('installer/src/claude/ not built; run installer/scripts/sync-source.js first');
    return;
  }

  // Run the installer into HOME=A.
  const homeA = withTempHome(t);
  const argvBefore = process.argv;
  process.argv = ['node', 'index.js', '--yes', '--harness', 'claude'];
  try {
    await installerMain();
  } finally {
    process.argv = argvBefore;
  }
  const installerRadorch = snapshotTree(path.join(homeA, '.radorch'));
  const installerClaude = snapshotTree(path.join(homeA, '.claude'));
  const installJsonA = JSON.parse(fs.readFileSync(path.join(homeA, '.radorch', 'install.json'), 'utf8'));

  // Reset HOME and run runPluginBootstrap directly into HOME=B.
  delete process.env.HOME;
  delete process.env.USERPROFILE;
  const homeB = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-int-pb-'));
  process.env.HOME = homeB;
  process.env.USERPROFILE = homeB;
  t.after(() => {
    try { fs.rmSync(homeB, { recursive: true, force: true }); } catch { /* best effort */ }
  });

  const pluginRoot = pluginRootFor('claude');
  await runPluginBootstrap({ pluginRoot, harness: 'claude' });
  const bootstrapRadorch = snapshotTree(path.join(homeB, '.radorch'));
  const bootstrapClaude = snapshotTree(path.join(homeB, '.claude'));
  const installJsonB = JSON.parse(fs.readFileSync(path.join(homeB, '.radorch', 'install.json'), 'utf8'));

  // .claude/ must be byte-identical (no installer-only overrides).
  assert.deepEqual(installerClaude, bootstrapClaude,
    '~/.claude/ trees must match between installer and runPluginBootstrap');

  // ~/.radorch/ — every file except install.json (timestamp) and orchestration.yml
  // (the installer writes one from the wizard config; plugin-bootstrap doesn't
  // touch it) must match.
  const ignored = new Set(['install.json', 'orchestration.yml']);
  const filterIgnored = (tree) => Object.fromEntries(
    Object.entries(tree).filter(([k]) => !ignored.has(k)),
  );
  assert.deepEqual(filterIgnored(installerRadorch), filterIgnored(bootstrapRadorch),
    '~/.radorch/ trees (minus install.json + orchestration.yml) must match');

  // install.json structural comparison (ignore installed_at timestamp).
  const { installed_at: _a, ...installerStrip } = installJsonA;
  const { installed_at: _b, ...bootstrapStrip } = installJsonB;
  assert.deepEqual(installerStrip, bootstrapStrip,
    'install.json structure must match (ignoring installed_at)');
});

test('installer no longer ships TS source tree in the bundled scripts/ folder', () => {
  // sync-source.js is responsible for excluding these from installer/src/.
  // This is a post-build assertion against the source bundle, not against a
  // live install.
  if (!pluginRootAvailable('claude')) {
    // Test relies on a built bundle; skip otherwise.
    return;
  }
  const scriptsDir = path.join(
    pluginRootFor('claude'), 'skills', 'rad-orchestration', 'scripts',
  );
  if (!fs.existsSync(scriptsDir)) return; // scripts may not be in legacy bundles
  const forbidden = [
    'tsconfig.json',
    'package.json',
    'package-lock.json',
    'env.d.ts',
    'bundle.mjs',
    'lib',
    'tests',
    'node_modules',
  ];
  for (const name of forbidden) {
    assert.ok(
      !fs.existsSync(path.join(scriptsDir, name)),
      `installer/src/claude/skills/rad-orchestration/scripts/${name} must not ship`,
    );
  }
  // pipeline.js MUST ship.
  assert.ok(
    fs.existsSync(path.join(scriptsDir, 'pipeline.js')),
    'pipeline.js must remain in the bundled scripts folder',
  );
});
