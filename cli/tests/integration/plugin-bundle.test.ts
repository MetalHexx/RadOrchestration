import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { execFile, execSync } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const pluginRoot = path.join(
  repoRoot,
  'cli',
  'dist',
  'marketplaces',
  'claude',
  'plugins',
  'rad-orchestration',
);
const bootstrapScript = path.join(repoRoot, 'greenfield', 'harness-installers', 'claude-plugin', 'hooks', 'bootstrap.mjs');

beforeAll(async () => {
  if (!(await fs.stat(pluginRoot).catch(() => null))) {
    // Plugin staging tree is now gitignored — build it on demand so the
    // integration test runs out of the box without a manual pre-build step.
    execSync('npm run build:plugin', {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32' ? true : undefined,
    });
  }
}, 180_000);

/**
 * Creates a minimal synthetic plugin root that run-install.js accepts.
 * The built plugin bundle uses ${HARNESS_ROOT}/... paths (for Claude Code skill
 * installation) which install-files.js rejects as escaping ~/.radorch/. Bootstrap
 * integration tests use this synthetic root so runInstall succeeds; bundle
 * artifact tests continue to use the real pluginRoot.
 */
async function makeBootstrapRoot(version: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-bp-'));
  await fs.mkdir(path.join(dir, 'skills', 'rad-orchestration', 'scripts'), { recursive: true });
  await fs.writeFile(path.join(dir, 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs'), '#!/usr/bin/env node\n');
  await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: '@rad-orchestration/claude-plugin', version }));
  await fs.mkdir(path.join(dir, 'manifests'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'manifests', `v${version}.json`),
    JSON.stringify({ version, files: [] }),
  );
  // Copy the real ui/ tree so the tree-copy step in runInstall hydrates radHome correctly.
  const realUiDir = path.join(pluginRoot, 'ui');
  if (fsSync.existsSync(realUiDir)) {
    fsSync.cpSync(realUiDir, path.join(dir, 'ui'), { recursive: true });
  }
  return dir;
}

let home: string;
beforeEach(async () => { home = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-plug-')); });
afterEach(async () => { await fs.rm(home, { recursive: true, force: true }); });

describe('bundle existence (FR-27 #1)', () => {
  it('every required artifact lives at its documented path', async () => {
    for (const rel of [
      '.claude-plugin/plugin.json',
      'skills/rad-orchestration/scripts/radorch.mjs',
      'skills/rad-orchestration/scripts/pipeline.js',
      'ui/server.js',
      'hooks/hooks.json',
      'skills/rad-ui-start/SKILL.md',
      'skills/rad-ui-stop/SKILL.md',
      'skills/rad-ui-status/SKILL.md',
    ]) {
      const f = path.join(pluginRoot, rel);
      const stat = await fs.stat(f);
      expect(stat.isFile() || stat.isDirectory()).toBe(true);
    }
  });
});

describe('bundle invocability (FR-27 #2)', () => {
  it('spawning the bundled CLI runs --version successfully', async () => {
    const bundle = path.join(pluginRoot, 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs');
    const r = await execP('node', [bundle, '--version']);
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('SessionStart bootstrap (FR-27 #3, #4)', () => {
  it('first run bootstraps; second run is a no-op', { timeout: 30_000 }, async () => {
    // Use a synthetic plugin root with ${RAD_HOME} manifest paths; the real
    // built bundle uses ${HARNESS_ROOT} paths (for Claude Code skill installation)
    // which install-files.js correctly rejects as escaping ~/.radorch/.
    const version = JSON.parse(fsSync.readFileSync(path.join(pluginRoot, 'package.json'), 'utf8')).version as string;
    const bpRoot = await makeBootstrapRoot(version);
    const radHome = path.join(home, '.radorch');
    try {
      const env = { ...process.env, CLAUDE_PLUGIN_ROOT: bpRoot, RAD_HOME: radHome };
      await execP('node', [bootstrapScript], { env });
      expect(await fs.stat(path.join(radHome, 'projects'))).toBeTruthy();
      const before = await fs.readFile(path.join(radHome, 'install.json'), 'utf8');
      await execP('node', [bootstrapScript], { env });
      const after = await fs.readFile(path.join(radHome, 'install.json'), 'utf8');
      expect(before).toBe(after);
    } finally {
      await fs.rm(bpRoot, { recursive: true, force: true });
    }
  });
});

describe('ui lifecycle (FR-27 #5, FR-28)', () => {
  it('ui start → status → stop via the bundled CLI', async () => {
    const bundle = path.join(pluginRoot, 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs');
    // Bootstrap via bootstrap.mjs directly (plugin-bootstrap subcommand was removed).
    // Use a synthetic plugin root for the bootstrap step — the real bundle manifest
    // uses ${HARNESS_ROOT} paths (incompatible with install-files.js).
    const version = JSON.parse(fsSync.readFileSync(path.join(pluginRoot, 'package.json'), 'utf8')).version as string;
    const bpRoot = await makeBootstrapRoot(version);
    const radHome = path.join(home, '.radorch');
    const env = { ...process.env, CLAUDE_PLUGIN_ROOT: bpRoot, RAD_HOME: radHome, RADORCH_NO_LOG: '1', HOME: home, USERPROFILE: home };
    try {
      await execP('node', [bootstrapScript], { env });
      const startR = await execP('node', [bundle, 'ui', 'start', '--non-interactive', '--json'], { env });
      const startEnv = JSON.parse(startR.stdout.trim());
      expect(startEnv.ok).toBe(true);
      expect(startEnv.data.url).toMatch(/^http:\/\/localhost:\d+$/);
      expect(startEnv.data.pid).toBeGreaterThan(0);

      // Give the UI a moment to mount before status probes
      await new Promise((r) => setTimeout(r, 800));
      const statusR = await execP('node', [bundle, 'ui', 'status', '--non-interactive', '--json'], { env });
      const statusEnv = JSON.parse(statusR.stdout.trim());
      expect(statusEnv.ok).toBe(true);
      expect(statusEnv.data.running).toBe(true);
      expect(statusEnv.data.url).toBe(startEnv.data.url);

      const stopR = await execP('node', [bundle, 'ui', 'stop', '--non-interactive', '--json'], { env });
      const stopEnv = JSON.parse(stopR.stdout.trim());
      expect(stopEnv.ok).toBe(true);
      expect(stopEnv.data.stopped).toBe(true);

      const statusR2 = await execP('node', [bundle, 'ui', 'status', '--non-interactive', '--json'], { env });
      const statusEnv2 = JSON.parse(statusR2.stdout.trim());
      expect(statusEnv2.ok).toBe(true);
      expect(statusEnv2.data.running).toBe(false);
    } finally {
      await fs.rm(bpRoot, { recursive: true, force: true });
    }
  }, 30_000);
});

describe('plugin completeness (NFR-6, FR-1, FR-2, FR-4, FR-6)', () => {
  it('every canonical skill is enumerable under skills/', async () => {
    const canonRoot = path.resolve(__dirname, '..', '..', '..');
    const canonical = (await fs.readdir(path.join(canonRoot, 'skills'), { withFileTypes: true }))
      .filter(d => d.isDirectory()).map(d => d.name);
    for (const s of canonical) {
      await fs.access(path.join(pluginRoot, 'skills', s, 'SKILL.md'));
    }
  });
  it('every canonical agent is shipped under agents/', async () => {
    const canonRoot = path.resolve(__dirname, '..', '..', '..');
    const canonical = (await fs.readdir(path.join(canonRoot, 'agents'))).filter(f => f.endsWith('.md'));
    for (const a of canonical) {
      await fs.access(path.join(pluginRoot, 'agents', a));
    }
  });
  it('orchestrator body uses the namespaced rad-orchestration: dispatch form', async () => {
    const text = await fs.readFile(path.join(pluginRoot, 'agents', 'orchestrator.md'), 'utf8');
    for (const a of ['coder', 'reviewer', 'planner', 'brainstormer', 'source-control']) {
      expect(text).toMatch(new RegExp(`rad-orchestration:${a}\\b`));
    }
  });
  it('skills/rad-orchestration/scripts/pipeline.js is the esbuild bundle (no JIT shim markers)', async () => {
    const text = await fs.readFile(path.join(pluginRoot, 'skills', 'rad-orchestration', 'scripts', 'pipeline.js'), 'utf8');
    expect(text).not.toMatch(/\bnpx\s+tsx\b/);
    expect(text).not.toMatch(/\bnpm\s+ci\b/);
  });
});
