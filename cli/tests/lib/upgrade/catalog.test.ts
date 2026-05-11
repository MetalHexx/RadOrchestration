import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadBundledManifest } from '../../../src/lib/upgrade/catalog.js';

const FAKE_HOME = '/fake/home';

describe('loadBundledManifest', () => {
  let tmpDir: string;

  beforeEach(() => {
    vi.spyOn(os, 'homedir').mockReturnValue(FAKE_HOME);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-test-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads manifest from <pluginRoot>/manifests/v<version>.json', () => {
    const pluginRoot = path.join(tmpDir, 'plugin');
    const manifestsDir = path.join(pluginRoot, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });

    const manifest = {
      harness: 'claude',
      version: '1.2.3',
      files: [
        { bundlePath: 'agents/planner.md', sha256: 'abc123', ownership: 'managed' },
      ],
    };
    fs.writeFileSync(path.join(manifestsDir, 'v1.2.3.json'), JSON.stringify(manifest), 'utf8');

    const result = loadBundledManifest(pluginRoot, '1.2.3');
    expect(result).toEqual(manifest);
  });

  it('returns correct files array from the manifest', () => {
    const pluginRoot = path.join(tmpDir, 'plugin2');
    const manifestsDir = path.join(pluginRoot, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });

    const manifest = {
      harness: 'claude',
      version: '2.0.0',
      files: [
        { bundlePath: 'agents/coder.md', sha256: 'def456', ownership: 'managed' },
        { bundlePath: 'templates/high.yml', sha256: 'ghi789', ownership: 'managed' },
      ],
    };
    fs.writeFileSync(path.join(manifestsDir, 'v2.0.0.json'), JSON.stringify(manifest), 'utf8');

    const result = loadBundledManifest(pluginRoot, '2.0.0');
    expect(result.files).toHaveLength(2);
    expect(result.files[0]?.bundlePath).toBe('agents/coder.md');
    expect(result.files[1]?.bundlePath).toBe('templates/high.yml');
  });

  it('throws when version manifest does not exist', () => {
    const pluginRoot = path.join(tmpDir, 'plugin3');
    const manifestsDir = path.join(pluginRoot, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });

    expect(() => loadBundledManifest(pluginRoot, '99.0.0')).toThrow(/99\.0\.0/);
  });

  it('throws with informative message including the missing path', () => {
    const pluginRoot = path.join(tmpDir, 'plugin4');
    const manifestsDir = path.join(pluginRoot, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });

    expect(() => loadBundledManifest(pluginRoot, '5.0.0')).toThrow(/manifests/);
  });
});
