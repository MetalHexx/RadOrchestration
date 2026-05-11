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
          { bundlePath: `agents/planner-${ver}.md`, sha256: 'aabbcc', ownership: 'managed' },
          { bundlePath: `templates/high-${ver}.yml`, sha256: 'ddeeff', ownership: 'managed' },
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

  /** Write install.json to the fake home ~/.radorch/install.json */
  function writeInstallJson(packageVersion: string): void {
    const radorch = path.join(tmpDir, '.radorch');
    fs.mkdirSync(radorch, { recursive: true });
    fs.writeFileSync(
      path.join(radorch, 'install.json'),
      JSON.stringify({
        package_version: packageVersion,
        installed_at: new Date().toISOString(),
        last_writer_version: packageVersion,
        state_schema_version: 'v5',
      }, null, 2) + '\n',
      'utf8',
    );
  }

  /** Create the sentinel file that signals a working install exists */
  function writeSentinel(): void {
    const binDir = path.join(tmpDir, '.radorch', 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(binDir, 'radorch.mjs'), '#!/usr/bin/env node\n', 'utf8');
  }

  it('fast-exits no-op when installed === delivering', async () => {
    // Arrange: ~/.radorch/install.json exists with package_version='1.0.0';
    // pluginRoot/package.json carries '1.0.0'.
    const pluginRoot = makePluginRoot('1.0.0');
    writeInstallJson('1.0.0');
    writeSentinel();
    const lockPath = path.join(tmpDir, '.radorch', 'runtime', 'bootstrap.lock');

    // Act
    const result = await runPluginBootstrap({ pluginRoot, harness: 'claude' });

    // Assert: noop, no lock file created, install.json untouched
    expect(result.action).toBe('noop');
    expect(result.code).toBe(0);
    expect(fs.existsSync(lockPath)).toBe(false);
    const ij = JSON.parse(fs.readFileSync(path.join(tmpDir, '.radorch', 'install.json'), 'utf8'));
    expect(ij.package_version).toBe('1.0.0');

    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('downgrade prints warning and no-ops', async () => {
    // delivering '0.9.0', installed '1.0.0'.
    const pluginRoot = makePluginRoot('0.9.0');
    writeInstallJson('1.0.0');
    writeSentinel();

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Act
    const result = await runPluginBootstrap({ pluginRoot, harness: 'claude' });

    // Assert
    expect(result.action).toBe('downgrade-noop');
    expect(result.code).toBe(0);
    // The message field must mention the version comparison
    expect(result.message).toMatch(/Delivering v0\.9\.0 is older than installed v1\.0\.0/);

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

    // install.json must be stamped
    const ijPath = path.join(tmpDir, '.radorch', 'install.json');
    expect(fs.existsSync(ijPath)).toBe(true);
    const ij = JSON.parse(fs.readFileSync(ijPath, 'utf8'));
    expect(ij.package_version).toBe('1.1.0');
    expect(ij.last_writer_version).toBe('1.1.0');

    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('upgrade composes hash-check → remove → install → stamp', async () => {
    // installed '1.0.0', delivering '1.1.0', both manifests present in
    // bundled catalog. No modified files (sha256 check skips missing files).
    const pluginRoot = makePluginRoot('1.1.0', ['1.0.0']);
    writeInstallJson('1.0.0');
    writeSentinel();

    // Act
    const result = await runPluginBootstrap({ pluginRoot, harness: 'claude' });

    // Assert
    expect(result.action).toBe('upgrade-complete');
    expect(result.code).toBe(0);

    // install.json must be updated to the new version
    const ijPath = path.join(tmpDir, '.radorch', 'install.json');
    const ij = JSON.parse(fs.readFileSync(ijPath, 'utf8'));
    expect(ij.package_version).toBe('1.1.0');

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
    writeSentinel();

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
});
