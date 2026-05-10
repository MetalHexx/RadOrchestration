// hooks/session-start.test.mjs
//
// Verifies the canonical SessionStart hooks (sh + ps1) bootstrap a clean
// $RADORCH_HOME with everything the plugin runtime needs:
//
//   - install.json / registry.yml / config.yml         (existing contract)
//   - skills/rad-orchestration/config/orchestration.yml (plugin canonical
//     workspace: orch_root=".", projects.base_path="projects")
//   - ${CLAUDE_PLUGIN_ROOT}/ui/.env.local              (when CLAUDE_PLUGIN_ROOT
//     is set and ${CLAUDE_PLUGIN_ROOT}/ui exists)
//
// Both hook variants must agree on the orchestration.yml content (semantic
// equivalence, line-ending normalized) so the dashboard sees the same world
// regardless of which shell ran the hook.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS_DIR = path.join(repoRoot, 'hooks');

function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rad-hook-'));
}

function makeTempPluginRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-plugin-'));
  fs.mkdirSync(path.join(root, 'ui'), { recursive: true });
  return root;
}

function normalizeNewlines(s) {
  return s.replace(/\r\n/g, '\n');
}

function bashAvailable() {
  try {
    execFileSync('bash', ['--version'], { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

function pwshAvailable() {
  try {
    execFileSync('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

test('session-start.sh provisions install.json, orchestration.yml, registry.yml, config.yml', (t) => {
  if (!bashAvailable()) { t.skip('bash not available'); return; }
  const home = makeTempHome();
  try {
    execFileSync('bash', [path.join(HOOKS_DIR, 'session-start.sh')], {
      env: { ...process.env, RADORCH_HOME: home, CLAUDE_PLUGIN_ROOT: '' },
      stdio: 'pipe',
    });
    assert.ok(fs.existsSync(path.join(home, 'install.json')), 'install.json present');
    assert.ok(fs.existsSync(path.join(home, 'registry.yml')), 'registry.yml present');
    assert.ok(fs.existsSync(path.join(home, 'config.yml')), 'config.yml present');
    const ymlPath = path.join(home, 'skills', 'rad-orchestration', 'config', 'orchestration.yml');
    assert.ok(fs.existsSync(ymlPath), 'orchestration.yml present');
    const yml = fs.readFileSync(ymlPath, 'utf8');
    assert.match(yml, /^package_version:\s*\d/m, 'orchestration.yml has package_version');
    assert.match(yml, /orch_root:\s*"\."/, 'orch_root is "."');
    assert.match(yml, /base_path:\s*"projects"/, 'base_path is "projects"');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('session-start.ps1 provisions install.json, orchestration.yml, registry.yml, config.yml', (t) => {
  if (!pwshAvailable()) { t.skip('pwsh not available'); return; }
  const home = makeTempHome();
  try {
    execFileSync('pwsh', ['-NoProfile', '-File', path.join(HOOKS_DIR, 'session-start.ps1')], {
      env: { ...process.env, RADORCH_HOME: home, CLAUDE_PLUGIN_ROOT: '' },
      stdio: 'pipe',
    });
    assert.ok(fs.existsSync(path.join(home, 'install.json')), 'install.json present');
    assert.ok(fs.existsSync(path.join(home, 'registry.yml')), 'registry.yml present');
    assert.ok(fs.existsSync(path.join(home, 'config.yml')), 'config.yml present');
    const ymlPath = path.join(home, 'skills', 'rad-orchestration', 'config', 'orchestration.yml');
    assert.ok(fs.existsSync(ymlPath), 'orchestration.yml present');
    const yml = fs.readFileSync(ymlPath, 'utf8');
    assert.match(yml, /^package_version:\s*\d/m, 'orchestration.yml has package_version');
    assert.match(yml, /orch_root:\s*"\."/, 'orch_root is "."');
    assert.match(yml, /base_path:\s*"projects"/, 'base_path is "projects"');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('both hook variants produce semantically-equivalent orchestration.yml', (t) => {
  if (!bashAvailable() || !pwshAvailable()) {
    t.skip('both bash and pwsh required for cross-hook equivalence check');
    return;
  }
  const homeSh = makeTempHome();
  const homePs = makeTempHome();
  try {
    execFileSync('bash', [path.join(HOOKS_DIR, 'session-start.sh')], {
      env: { ...process.env, RADORCH_HOME: homeSh, CLAUDE_PLUGIN_ROOT: '' },
      stdio: 'pipe',
    });
    execFileSync('pwsh', ['-NoProfile', '-File', path.join(HOOKS_DIR, 'session-start.ps1')], {
      env: { ...process.env, RADORCH_HOME: homePs, CLAUDE_PLUGIN_ROOT: '' },
      stdio: 'pipe',
    });
    const ymlSh = normalizeNewlines(fs.readFileSync(
      path.join(homeSh, 'skills', 'rad-orchestration', 'config', 'orchestration.yml'), 'utf8',
    ));
    const ymlPs = normalizeNewlines(fs.readFileSync(
      path.join(homePs, 'skills', 'rad-orchestration', 'config', 'orchestration.yml'), 'utf8',
    ));
    assert.equal(ymlSh, ymlPs, 'orchestration.yml content (LF-normalized) matches between sh and ps1');
  } finally {
    fs.rmSync(homeSh, { recursive: true, force: true });
    fs.rmSync(homePs, { recursive: true, force: true });
  }
});

test('session-start.sh writes .env.local when CLAUDE_PLUGIN_ROOT is set', (t) => {
  if (!bashAvailable()) { t.skip('bash not available'); return; }
  const home = makeTempHome();
  const pluginRoot = makeTempPluginRoot();
  try {
    execFileSync('bash', [path.join(HOOKS_DIR, 'session-start.sh')], {
      env: { ...process.env, RADORCH_HOME: home, CLAUDE_PLUGIN_ROOT: pluginRoot },
      stdio: 'pipe',
    });
    const envLocal = path.join(pluginRoot, 'ui', '.env.local');
    assert.ok(fs.existsSync(envLocal), '.env.local created');
    const content = normalizeNewlines(fs.readFileSync(envLocal, 'utf8'));
    const lines = content.split('\n').filter(Boolean);
    assert.deepEqual(lines, [`WORKSPACE_ROOT=${home}`, 'ORCH_ROOT=.']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('session-start.ps1 writes .env.local when CLAUDE_PLUGIN_ROOT is set', (t) => {
  if (!pwshAvailable()) { t.skip('pwsh not available'); return; }
  const home = makeTempHome();
  const pluginRoot = makeTempPluginRoot();
  try {
    execFileSync('pwsh', ['-NoProfile', '-File', path.join(HOOKS_DIR, 'session-start.ps1')], {
      env: { ...process.env, RADORCH_HOME: home, CLAUDE_PLUGIN_ROOT: pluginRoot },
      stdio: 'pipe',
    });
    const envLocal = path.join(pluginRoot, 'ui', '.env.local');
    assert.ok(fs.existsSync(envLocal), '.env.local created');
    const content = normalizeNewlines(fs.readFileSync(envLocal, 'utf8'));
    const lines = content.split('\n').filter(Boolean);
    assert.deepEqual(lines, [`WORKSPACE_ROOT=${home}`, 'ORCH_ROOT=.']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('hooks are idempotent — second run does not overwrite existing files', (t) => {
  if (!bashAvailable()) { t.skip('bash not available'); return; }
  const home = makeTempHome();
  try {
    // First run
    execFileSync('bash', [path.join(HOOKS_DIR, 'session-start.sh')], {
      env: { ...process.env, RADORCH_HOME: home, CLAUDE_PLUGIN_ROOT: '' },
      stdio: 'pipe',
    });
    const ymlPath = path.join(home, 'skills', 'rad-orchestration', 'config', 'orchestration.yml');
    // User edits the file
    fs.writeFileSync(ymlPath, '# user-edited content\n', 'utf8');
    // Second run
    execFileSync('bash', [path.join(HOOKS_DIR, 'session-start.sh')], {
      env: { ...process.env, RADORCH_HOME: home, CLAUDE_PLUGIN_ROOT: '' },
      stdio: 'pipe',
    });
    const after = fs.readFileSync(ymlPath, 'utf8');
    assert.equal(after, '# user-edited content\n', 'user-edited orchestration.yml preserved');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
