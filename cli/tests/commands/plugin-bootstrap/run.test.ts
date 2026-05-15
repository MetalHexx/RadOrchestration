import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runPluginBootstrap } from '../../../src/commands/plugin-bootstrap/run.js';

describe('runPluginBootstrap', () => {
  // Each test sets HOME to a temp dir and provides a fake pluginRoot whose
  // package.json carries a known delivering version, plus a bundled
  // manifest catalog at <pluginRoot>/manifests/v<version>.json.

  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-bootstrap-test-'));
    vi.spyOn(os, 'homedir').mockReturnValue(tmpDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Build a minimal pluginRoot with package.json + manifest catalog entries */
  function makePluginRoot(version: string, additionalVersions: string[] = []): string {
    const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-plugin-root-'));
    // Write package.json
    fs.writeFileSync(
      path.join(pluginRoot, 'package.json'),
      JSON.stringify({ name: 'rad-orchestration', version }),
      'utf8',
    );
    // Create manifests directory
    const manifestsDir = path.join(pluginRoot, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });

    // Helper to write a versioned manifest + source files
    function writeManifestAndSources(ver: string): void {
      const manifest = {
        harness: 'claude',
        version: ver,
        files: [
          { bundlePath: `agents/planner-${ver}.md`, destinationPath: `\${HARNESS_ROOT}/agents/planner-${ver}.md`, sha256: 'aabbcc', ownership: 'managed' },
          { bundlePath: `templates/high-${ver}.yml`, destinationPath: `\${RAD_HOME}/templates/high-${ver}.yml`, sha256: 'ddeeff', ownership: 'managed' },
        ],
      };
      fs.writeFileSync(
        path.join(manifestsDir, `v${ver}.json`),
        JSON.stringify(manifest),
        'utf8',
      );
      // Create source files (needed by installManifestFiles)
      const agentsDir = path.join(pluginRoot, 'agents');
      const templatesDir = path.join(pluginRoot, 'templates');
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.mkdirSync(templatesDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, `planner-${ver}.md`), `planner content ${ver}`, 'utf8');
      fs.writeFileSync(path.join(templatesDir, `high-${ver}.yml`), `high template ${ver}`, 'utf8');
    }

    writeManifestAndSources(version);
    for (const v of additionalVersions) {
      writeManifestAndSources(v);
    }

    return pluginRoot;
  }

  /** Write a v6 install.json to the fake home with the supplied harness entry
   *  (defaults to claude-plugin since runPluginBootstrap's default channel is
   *  plugin). */
  function writeInstallJson(
    packageVersion: string,
    installKey: 'claude' | 'claude-plugin' | 'copilot-cli' | 'copilot-vscode' = 'claude-plugin',
    channel: 'plugin' | 'legacy-installer' = 'plugin',
  ): void {
    const radorch = path.join(tmpDir, '.radorch');
    fs.mkdirSync(radorch, { recursive: true });
    fs.writeFileSync(
      path.join(radorch, 'install.json'),
      JSON.stringify({
        state_schema_version: 'v6',
        harnesses: {
          [installKey]: {
            version: packageVersion,
            channel,
            installed_at: new Date().toISOString(),
            last_writer_version: packageVersion,
          },
        },
      }, null, 2) + '\n',
      'utf8',
    );
  }

  /** Create the sentinel file that signals a working install exists.
   *  The sentinel now lives inside the plugin payload at
   *  <pluginRoot>/skills/rad-orchestration/scripts/radorch.mjs (FR-7). */
  function writeSentinel(pluginRoot: string): void {
    const scriptsDir = path.join(pluginRoot, 'skills', 'rad-orchestration', 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.writeFileSync(path.join(scriptsDir, 'radorch.mjs'), '#!/usr/bin/env node\n', 'utf8');
  }

  it('fast-exits no-op when installed === delivering', async () => {
    // Arrange: ~/.radorch/install.json exists with package_version='1.0.0';
    // pluginRoot/package.json carries '1.0.0'.
    const pluginRoot = makePluginRoot('1.0.0');
    writeInstallJson('1.0.0');
    writeSentinel(pluginRoot);
    const lockPath = path.join(tmpDir, '.radorch', 'runtime', 'bootstrap.lock');

    // Act
    const result = await runPluginBootstrap({ pluginRoot, harness: 'claude' });

    // Assert: noop, no lock file created, install.json untouched
    expect(result.action).toBe('noop');
    expect(result.code).toBe(0);
    expect(fs.existsSync(lockPath)).toBe(false);
    const ij = JSON.parse(fs.readFileSync(path.join(tmpDir, '.radorch', 'install.json'), 'utf8'));
    expect(ij.state_schema_version).toBe('v6');
    expect(ij.harnesses['claude-plugin'].version).toBe('1.0.0');

    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('downgrade prints warning and no-ops', async () => {
    // delivering '0.9.0', installed '1.0.0'.
    const pluginRoot = makePluginRoot('0.9.0');
    writeInstallJson('1.0.0');
    writeSentinel(pluginRoot);

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Act
    const result = await runPluginBootstrap({ pluginRoot, harness: 'claude' });

    // Assert
    expect(result.action).toBe('downgrade-noop');
    expect(result.code).toBe(0);
    // The message field must mention the version comparison
    expect(result.message).toMatch(/Delivering v0\.9\.0 is older than installed v1\.0\.0/);
    // And must include the radorch doctor hint
    expect(result.message).toMatch(/radorch doctor/);

    stderrSpy.mockRestore();
    warnSpy.mockRestore();
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('treats fresh install (no install.json) as install regardless of version', async () => {
    // pluginRoot/package.json='1.1.0', no ~/.radorch/install.json.
    const pluginRoot = makePluginRoot('1.1.0');
    // No writeInstallJson call — fresh system

    // Act
    const result = await runPluginBootstrap({ pluginRoot, harness: 'claude' });

    // Assert
    expect(result.action).toBe('fresh-install');
    expect(result.code).toBe(0);

    // install.json must be stamped with the v6 claude-plugin entry.
    const ijPath = path.join(tmpDir, '.radorch', 'install.json');
    expect(fs.existsSync(ijPath)).toBe(true);
    const ij = JSON.parse(fs.readFileSync(ijPath, 'utf8'));
    expect(ij.state_schema_version).toBe('v6');
    const entry = ij.harnesses['claude-plugin'];
    expect(entry.version).toBe('1.1.0');
    expect(entry.last_writer_version).toBe('1.1.0');
    expect(entry.channel).toBe('plugin');

    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('upgrade composes hash-check → remove → install → stamp', async () => {
    // installed '1.0.0', delivering '1.1.0', both manifests present in
    // bundled catalog. No modified files (sha256 check skips missing files).
    // Using legacy-installer channel (sharedRoot set) so the test exercises
    // the full harness-root file deployment path.
    const pluginRoot = makePluginRoot('1.1.0', ['1.0.0']);
    writeInstallJson('1.0.0', 'claude', 'legacy-installer');
    writeSentinel(pluginRoot);

    // Act
    const result = await runPluginBootstrap({ pluginRoot, sharedRoot: pluginRoot, harness: 'claude' });

    // Assert
    expect(result.action).toBe('upgrade-complete');
    expect(result.code).toBe(0);

    // install.json must be updated to the new version (v6 claude entry)
    const ijPath = path.join(tmpDir, '.radorch', 'install.json');
    const ij = JSON.parse(fs.readFileSync(ijPath, 'utf8'));
    expect(ij.harnesses['claude'].version).toBe('1.1.0');

    // New manifest files should now exist at their target paths
    const newAgentTarget = path.join(tmpDir, '.claude', 'agents', 'planner-1.1.0.md');
    expect(fs.existsSync(newAgentTarget)).toBe(true);

    // v1.0.0-only files should have been removed (they were never installed in
    // this test's tmpDir, so they won't be present — removedCount doesn't error)
    const oldAgentTarget = path.join(tmpDir, '.claude', 'agents', 'planner-1.0.0.md');
    expect(fs.existsSync(oldAgentTarget)).toBe(false);

    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('concurrent invocation exits 0 with in-progress message', async () => {
    // Pre-create ~/.radorch/runtime/bootstrap.lock with a fake PID.
    const pluginRoot = makePluginRoot('1.1.0', ['1.0.0']);
    writeInstallJson('1.0.0');
    writeSentinel(pluginRoot);

    // Pre-create the lock file to simulate a concurrent invocation
    const runtimeDir = path.join(tmpDir, '.radorch', 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true });
    const lockPath = path.join(runtimeDir, 'bootstrap.lock');
    fs.writeFileSync(lockPath, '99999', 'utf8');

    // Act
    const result = await runPluginBootstrap({ pluginRoot, harness: 'claude' });

    // Assert
    expect(result.action).toBe('lock-busy');
    expect(result.code).toBe(0);

    // Lock file should still exist (we didn't acquire it)
    expect(fs.existsSync(lockPath)).toBe(true);

    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('force re-installs even when installed === delivering', async () => {
    // Arrange: installed === delivering === '1.0.0'; both bundled manifests
    // present; sentinel <pluginRoot>/skills/rad-orchestration/scripts/radorch.mjs exists.
    const pluginRoot = makePluginRoot('1.0.0');
    writeInstallJson('1.0.0');
    writeSentinel(pluginRoot);

    // Act
    const result = await runPluginBootstrap({ pluginRoot, harness: 'claude', force: true });

    // Assert
    expect(result.action).toBe('upgrade-complete');
    expect(result.code).toBe(0);

    // install.json.last_writer_version should be re-stamped (v6 claude-plugin entry)
    const ijPath = path.join(tmpDir, '.radorch', 'install.json');
    const ij = JSON.parse(fs.readFileSync(ijPath, 'utf8'));
    expect(ij.harnesses['claude-plugin'].last_writer_version).toBe('1.0.0');

    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('legacy-installer bootstrap copies a real skills/.../radorch.mjs (FR-7, NFR-6)', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-bin-'));
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-bin-src-'));
    const cliRel = 'skills/rad-orchestration/scripts/radorch.mjs';
    const cliRelParts = cliRel.split('/');
    fs.mkdirSync(path.join(root, ...cliRelParts.slice(0, -1)), { recursive: true });
    const sourceBytes = '#!/usr/bin/env node\nconsole.log("rad");\n';
    fs.writeFileSync(path.join(root, ...cliRelParts), sourceBytes);
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'rad-orchestration', version: '0.0.0-test' }),
      'utf8',
    );
    fs.mkdirSync(path.join(root, 'manifests'), { recursive: true });
    fs.writeFileSync(path.join(root, 'manifests', 'v0.0.0-test.json'), JSON.stringify({
      version: '0.0.0-test', package_version: '0.0.0-test', harness: 'claude',
      files: [{ bundlePath: cliRel, destinationPath: '${HARNESS_ROOT}/' + cliRel, sourcePath: cliRel, ownership: 'orchestration-system', version: '0.0.0-test', harness: 'claude' }],
    }));
    const origHomedir = os.homedir;
    try {
      (os as unknown as { homedir: () => string }).homedir = () => home;
      await runPluginBootstrap({ pluginRoot: root, sharedRoot: root, harness: 'claude' });
    } finally {
      (os as unknown as { homedir: () => string }).homedir = origHomedir;
    }
    // skills/* routes to harnessRoot('claude') = <home>/.claude (not ~/.radorch).
    const installed = path.join(home, '.claude', ...cliRelParts);
    const stat = fs.statSync(installed);
    expect(stat.size).toBeGreaterThan(0);
    expect(fs.readFileSync(installed, 'utf8')).toEqual(sourceBytes);
    if (process.platform !== 'win32') {
      // POSIX: 0o755 (the chmod NFR-6 prescribes) — owner-exec bit must be set.
      expect(stat.mode & 0o100).toBe(0o100);
    }
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('fresh-install writes all four base files (config.yml, registry.yml, .harness, .gitignore)', async () => {
    const pluginRoot = makePluginRoot('1.2.0');

    const result = await runPluginBootstrap({ pluginRoot, harness: 'claude' });

    expect(result.action).toBe('fresh-install');
    const radorch = path.join(tmpDir, '.radorch');
    expect(fs.existsSync(path.join(radorch, 'config.yml'))).toBe(true);
    expect(fs.existsSync(path.join(radorch, 'registry.yml'))).toBe(true);
    expect(fs.existsSync(path.join(radorch, '.harness'))).toBe(true);
    expect(fs.existsSync(path.join(radorch, '.gitignore'))).toBe(true);

    expect(fs.readFileSync(path.join(radorch, '.harness'), 'utf8').trim()).toBe('claude');
    expect(fs.readFileSync(path.join(radorch, 'config.yml'), 'utf8')).toMatch(/default_active_harness:\s*claude/);
    expect(fs.readFileSync(path.join(radorch, 'registry.yml'), 'utf8')).toMatch(/repos:/);

    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('upgrade path self-heals when base files are missing', async () => {
    const pluginRoot = makePluginRoot('1.1.0', ['1.0.0']);
    writeInstallJson('1.0.0');
    writeSentinel(pluginRoot);
    const radorch = path.join(tmpDir, '.radorch');

    expect(fs.existsSync(path.join(radorch, 'config.yml'))).toBe(false);
    expect(fs.existsSync(path.join(radorch, 'registry.yml'))).toBe(false);

    const result = await runPluginBootstrap({ pluginRoot, harness: 'claude' });

    expect(result.action).toBe('upgrade-complete');
    expect(fs.existsSync(path.join(radorch, 'config.yml'))).toBe(true);
    expect(fs.existsSync(path.join(radorch, 'registry.yml'))).toBe(true);
    expect(fs.existsSync(path.join(radorch, '.harness'))).toBe(true);
    expect(fs.existsSync(path.join(radorch, '.gitignore'))).toBe(true);

    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('bootstrap preserves a pre-seeded ~/.radorch/projects/ tree (FR-12)', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-projects-'));
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-projects-src-'));
    const seededState = path.join(home, '.radorch', 'projects', 'EXISTING-PROJECT', 'state.json');
    fs.mkdirSync(path.dirname(seededState), { recursive: true });
    const seededBytes = JSON.stringify({ marker: 'untouched' });
    fs.writeFileSync(seededState, seededBytes);
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'rad-orchestration', version: '0.0.0-test' }),
      'utf8',
    );
    fs.mkdirSync(path.join(root, 'manifests'), { recursive: true });
    fs.writeFileSync(path.join(root, 'manifests', 'v0.0.0-test.json'), JSON.stringify({
      version: '0.0.0-test', package_version: '0.0.0-test', harness: 'claude', files: [],
    }));
    const origHomedir = os.homedir;
    try {
      (os as unknown as { homedir: () => string }).homedir = () => home;
      await runPluginBootstrap({ pluginRoot: root, harness: 'claude' });
      expect(fs.readFileSync(seededState, 'utf8')).toEqual(seededBytes);
      // Second run = upgrade path.
      await runPluginBootstrap({ pluginRoot: root, harness: 'claude', force: true });
      expect(fs.readFileSync(seededState, 'utf8')).toEqual(seededBytes);
    } finally {
      (os as unknown as { homedir: () => string }).homedir = origHomedir;
    }
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('writes claude-plugin key on fresh plugin install', async () => {
    const pluginRoot = makePluginRoot('1.0.0');
    const result = await runPluginBootstrap({ pluginRoot, harness: 'claude' });
    expect(result.action).toBe('fresh-install');
    const ij = JSON.parse(fs.readFileSync(path.join(tmpDir, '.radorch', 'install.json'), 'utf8'));
    expect(ij.state_schema_version).toBe('v6');
    expect(ij.harnesses['claude-plugin']).toBeDefined();
    expect(ij.harnesses['claude-plugin'].channel).toBe('plugin');
    expect(ij.harnesses['claude-plugin'].version).toBe('1.0.0');
    expect(ij.harnesses['claude']).toBeUndefined();
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('legacy-installer path (sharedRoot set) writes claude key, not claude-plugin', async () => {
    const pluginRoot = makePluginRoot('1.0.0');
    // sharedRoot toggles channel detection to legacy-installer.
    const result = await runPluginBootstrap({ pluginRoot, sharedRoot: pluginRoot, harness: 'claude' });
    expect(result.action).toBe('fresh-install');
    const ij = JSON.parse(fs.readFileSync(path.join(tmpDir, '.radorch', 'install.json'), 'utf8'));
    expect(ij.harnesses['claude']).toBeDefined();
    expect(ij.harnesses['claude'].channel).toBe('legacy-installer');
    expect(ij.harnesses['claude-plugin']).toBeUndefined();
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('plugin install warns to stderr when legacy claude entry is registered (coexist)', async () => {
    const pluginRoot = makePluginRoot('1.0.0');
    // Pre-existing legacy claude entry.
    writeInstallJson('0.9.0', 'claude', 'legacy-installer');

    const origWrite = process.stderr.write.bind(process.stderr);
    let captured = '';
    (process.stderr.write as unknown) = (chunk: string | Uint8Array) => { captured += String(chunk); return true; };
    let result;
    try {
      result = await runPluginBootstrap({ pluginRoot, harness: 'claude' });
    } finally {
      (process.stderr.write as unknown) = origWrite;
    }
    expect(result.action).toBe('fresh-install');
    const ij = JSON.parse(fs.readFileSync(path.join(tmpDir, '.radorch', 'install.json'), 'utf8'));
    expect(ij.harnesses['claude']).toBeDefined();
    expect(ij.harnesses['claude-plugin']).toBeDefined();
    // Both coexist; warning was emitted.
    expect(captured).toMatch(/legacy install of rad-orchestration is also registered/);
    expect(captured).toMatch(/npx rad-orchestration uninstall/);
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('plugin install migrates a v5 install.json on read and writes v6 with claude-plugin key', async () => {
    const pluginRoot = makePluginRoot('1.1.0', ['1.0.0']);
    // Stage a v5 install.json. After bootstrap it should be migrated to v6.
    const radorch = path.join(tmpDir, '.radorch');
    fs.mkdirSync(radorch, { recursive: true });
    fs.writeFileSync(path.join(radorch, 'install.json'), JSON.stringify({
      package_version: '1.0.0',
      installed_at: '2026-04-01T00:00:00.000Z',
      last_writer_version: '1.0.0',
      state_schema_version: 'v5',
    }, null, 2) + '\n');
    writeSentinel(pluginRoot);

    const result = await runPluginBootstrap({ pluginRoot, harness: 'claude' });
    expect(result.action).toBe('upgrade-complete');
    const ij = JSON.parse(fs.readFileSync(path.join(radorch, 'install.json'), 'utf8'));
    expect(ij.state_schema_version).toBe('v6');
    expect(ij.harnesses['claude-plugin']).toBeDefined();
    expect(ij.harnesses['claude-plugin'].version).toBe('1.1.0');
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('plugin-channel fresh install does not deploy skills/* to ~/.claude/', async () => {
    const pluginRoot = makePluginRoot('1.0.0');
    // Manifest with a ${HARNESS_ROOT}/skills/... entry (not deployed on plugin channel).
    const manifestPath = path.join(pluginRoot, 'manifests', 'v1.0.0.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.files.push({
      bundlePath: 'agents/test-agent.md',
      destinationPath: '${HARNESS_ROOT}/agents/test-agent.md',
      sha256: 'aabbcc',
      ownership: 'managed',
    });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    fs.writeFileSync(path.join(pluginRoot, 'agents', 'test-agent.md'), 'test agent content', 'utf8');

    const result = await runPluginBootstrap({ pluginRoot, harness: 'claude' });

    expect(result.action).toBe('fresh-install');
    // Plugin channel must NOT deploy to ~/.claude/agents/...
    const agentPath = path.join(tmpDir, '.claude', 'agents', 'test-agent.md');
    expect(fs.existsSync(agentPath)).toBe(false);
    // But install.json and base files must be stamped.
    const ijPath = path.join(tmpDir, '.radorch', 'install.json');
    expect(fs.existsSync(ijPath)).toBe(true);
    const ij = JSON.parse(fs.readFileSync(ijPath, 'utf8'));
    expect(ij.harnesses['claude-plugin']).toBeDefined();
    // Base files must be present.
    expect(fs.existsSync(path.join(tmpDir, '.radorch', 'config.yml'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.radorch', 'registry.yml'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.radorch', '.harness'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.radorch', '.gitignore'))).toBe(true);

    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('plugin-channel upgrade does not deploy and gracefully removes prior manifest\'s nonexistent files', async () => {
    const pluginRoot = makePluginRoot('1.1.0', ['1.0.0']);
    // Both manifests have ${HARNESS_ROOT}/agents/... entries that won't be deployed on plugin channel.
    const v1Path = path.join(pluginRoot, 'manifests', 'v1.0.0.json');
    const v1Manifest = JSON.parse(fs.readFileSync(v1Path, 'utf8'));
    v1Manifest.files.push({
      bundlePath: 'agents/old-agent.md',
      destinationPath: '${HARNESS_ROOT}/agents/old-agent.md',
      sha256: 'oldsha',
      ownership: 'managed',
    });
    fs.writeFileSync(v1Path, JSON.stringify(v1Manifest));
    fs.writeFileSync(path.join(pluginRoot, 'agents', 'old-agent.md'), 'old agent content', 'utf8');

    const v11Path = path.join(pluginRoot, 'manifests', 'v1.1.0.json');
    const v11Manifest = JSON.parse(fs.readFileSync(v11Path, 'utf8'));
    v11Manifest.files.push({
      bundlePath: 'agents/new-agent.md',
      destinationPath: '${HARNESS_ROOT}/agents/new-agent.md',
      sha256: 'newsha',
      ownership: 'managed',
    });
    fs.writeFileSync(v11Path, JSON.stringify(v11Manifest));
    fs.writeFileSync(path.join(pluginRoot, 'agents', 'new-agent.md'), 'new agent content', 'utf8');

    // Pre-write install.json + sentinel at 1.0.0
    writeInstallJson('1.0.0');
    writeSentinel(pluginRoot);

    const result = await runPluginBootstrap({ pluginRoot, harness: 'claude' });

    expect(result.action).toBe('upgrade-complete');
    // Neither old nor new agent should be deployed (plugin channel skips harness-root).
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'agents', 'old-agent.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'agents', 'new-agent.md'))).toBe(false);
    // install.json must be updated to 1.1.0.
    const ijPath = path.join(tmpDir, '.radorch', 'install.json');
    const ij = JSON.parse(fs.readFileSync(ijPath, 'utf8'));
    expect(ij.harnesses['claude-plugin'].version).toBe('1.1.0');

    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('plugin-channel --force re-install also does not deploy', async () => {
    const pluginRoot = makePluginRoot('1.0.0');
    // Manifest with a harness-root entry.
    const manifestPath = path.join(pluginRoot, 'manifests', 'v1.0.0.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.files.push({
      bundlePath: 'skills/test-skill/SKILL.md',
      destinationPath: '${HARNESS_ROOT}/skills/test-skill/SKILL.md',
      sha256: 'skillsha',
      ownership: 'managed',
    });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    fs.mkdirSync(path.join(pluginRoot, 'skills', 'test-skill'), { recursive: true });
    fs.writeFileSync(path.join(pluginRoot, 'skills', 'test-skill', 'SKILL.md'), 'skill content', 'utf8');

    writeInstallJson('1.0.0');
    writeSentinel(pluginRoot);

    const result = await runPluginBootstrap({ pluginRoot, harness: 'claude', force: true });

    expect(result.action).toBe('upgrade-complete');
    // Plugin channel --force must also skip harness-root writes.
    const skillPath = path.join(tmpDir, '.claude', 'skills', 'test-skill', 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(false);

    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('plugin-channel install over a registered legacy claude entry still emits the coexistence warning', async () => {
    const pluginRoot = makePluginRoot('1.0.0');
    // Pre-seed install.json with a legacy claude entry.
    writeInstallJson('0.9.0', 'claude', 'legacy-installer');

    const origWrite = process.stderr.write.bind(process.stderr);
    let captured = '';
    (process.stderr.write as unknown) = (chunk: string | Uint8Array) => { captured += String(chunk); return true; };
    let result;
    try {
      result = await runPluginBootstrap({ pluginRoot, harness: 'claude' });
    } finally {
      (process.stderr.write as unknown) = origWrite;
    }

    expect(result.action).toBe('fresh-install');
    const ijPath = path.join(tmpDir, '.radorch', 'install.json');
    const ij = JSON.parse(fs.readFileSync(ijPath, 'utf8'));
    // Both entries must coexist.
    expect(ij.harnesses['claude']).toBeDefined();
    expect(ij.harnesses['claude-plugin']).toBeDefined();
    // Warning must be emitted.
    expect(captured).toMatch(/legacy install of rad-orchestration is also registered/);

    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });
});
