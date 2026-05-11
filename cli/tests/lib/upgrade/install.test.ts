import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installManifestFiles } from '../../../src/lib/upgrade/install.js';

describe('installManifestFiles', () => {
  let tmpDir: string;
  let fakeHome: string;
  let pluginRoot: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'));
    fakeHome = tmpDir;
    pluginRoot = path.join(tmpDir, 'plugin');
    vi.spyOn(os, 'homedir').mockReturnValue(fakeHome);

    // Create plugin source layout
    const agentsDir = path.join(pluginRoot, 'agents');
    const templatesDir = path.join(pluginRoot, 'templates');
    const skillDir = path.join(pluginRoot, 'skills', 'rad-plan');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.mkdirSync(templatesDir, { recursive: true });
    fs.mkdirSync(skillDir, { recursive: true });

    fs.writeFileSync(path.join(agentsDir, 'planner.md'), 'planner content', 'utf8');
    fs.writeFileSync(path.join(templatesDir, 'high.yml'), 'high template', 'utf8');
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), 'skill content', 'utf8');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('copies harness-routed entry (agents/) to the correct target location', () => {
    const manifest = {
      files: [{ bundlePath: 'agents/planner.md' }],
    };

    const result = installManifestFiles(manifest, pluginRoot, 'claude');

    const target = path.join(fakeHome, '.claude', 'agents', 'planner.md');
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.readFileSync(target, 'utf8')).toBe('planner content');
    expect(result.copiedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
  });

  it('copies root-routed entry (templates/) to the correct target location', () => {
    const manifest = {
      files: [{ bundlePath: 'templates/high.yml' }],
    };

    const result = installManifestFiles(manifest, pluginRoot, 'claude');

    const target = path.join(fakeHome, '.radorch', 'templates', 'high.yml');
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.readFileSync(target, 'utf8')).toBe('high template');
    expect(result.copiedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
  });

  it('creates intermediate directories automatically', () => {
    const manifest = {
      files: [{ bundlePath: 'skills/rad-plan/SKILL.md' }],
    };

    const result = installManifestFiles(manifest, pluginRoot, 'claude');

    const target = path.join(fakeHome, '.claude', 'skills', 'rad-plan', 'SKILL.md');
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.readFileSync(target, 'utf8')).toBe('skill content');
    expect(result.copiedCount).toBe(1);
  });

  it('handles multiple entries and returns correct counts', () => {
    const manifest = {
      files: [
        { bundlePath: 'agents/planner.md' },
        { bundlePath: 'templates/high.yml' },
        { bundlePath: 'skills/rad-plan/SKILL.md' },
      ],
    };

    const result = installManifestFiles(manifest, pluginRoot, 'claude');

    expect(result.copiedCount).toBe(3);
    expect(result.skippedCount).toBe(0);
  });

  it('AD-7: never copies an entry that routes under projects/', () => {
    // Simulate a maliciously/erroneously crafted manifest that would route
    // to ~/.radorch/projects/ — the hard guard must block it.
    const projectsDir = path.join(pluginRoot, 'projects', 'my-project');
    fs.mkdirSync(projectsDir, { recursive: true });
    fs.writeFileSync(path.join(projectsDir, 'state.json'), '{"evil":"payload"}', 'utf8');

    const manifest = {
      files: [{ bundlePath: 'projects/my-project/state.json' }],
    };

    const result = installManifestFiles(manifest, pluginRoot, 'claude');

    // Nothing should be written under projects/
    const target = path.join(fakeHome, '.radorch', 'projects', 'my-project', 'state.json');
    expect(fs.existsSync(target)).toBe(false);
    expect(result.copiedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
  });
});
