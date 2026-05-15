import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { removeManifestFiles } from '../../../src/lib/upgrade/remove.js';

describe('removeManifestFiles', () => {
  let tmpDir: string;
  let fakeHome: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remove-test-'));
    fakeHome = tmpDir;
    vi.spyOn(os, 'homedir').mockReturnValue(fakeHome);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('removes harness-routed files (agents/) from the correct location', () => {
    const harnessRoot = path.join(fakeHome, '.claude');
    const agentsDir = path.join(harnessRoot, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });

    const agentFile = path.join(agentsDir, 'planner.md');
    fs.writeFileSync(agentFile, 'planner content', 'utf8');
    expect(fs.existsSync(agentFile)).toBe(true);

    const manifest = {
      files: [{ bundlePath: 'agents/planner.md', destinationPath: '${HARNESS_ROOT}/agents/planner.md' }],
    };

    const result = removeManifestFiles(manifest, 'claude');
    expect(result.removedCount).toBe(1);
    expect(fs.existsSync(agentFile)).toBe(false);
  });

  it('removes root-routed files (templates/) from the correct location', () => {
    const radOrchRoot = path.join(fakeHome, '.radorch');
    const templatesDir = path.join(radOrchRoot, 'templates');
    fs.mkdirSync(templatesDir, { recursive: true });

    const templateFile = path.join(templatesDir, 'high.yml');
    fs.writeFileSync(templateFile, 'template content', 'utf8');
    expect(fs.existsSync(templateFile)).toBe(true);

    const manifest = {
      files: [{ bundlePath: 'templates/high.yml', destinationPath: '${RAD_HOME}/templates/high.yml' }],
    };

    const result = removeManifestFiles(manifest, 'claude');
    expect(result.removedCount).toBe(1);
    expect(fs.existsSync(templateFile)).toBe(false);
  });

  it('prunes empty parent directories after removal', () => {
    const harnessRoot = path.join(fakeHome, '.claude');
    const skillDir = path.join(harnessRoot, 'skills', 'rad-plan');
    fs.mkdirSync(skillDir, { recursive: true });

    const skillFile = path.join(skillDir, 'SKILL.md');
    fs.writeFileSync(skillFile, 'skill content', 'utf8');

    const manifest = {
      files: [{ bundlePath: 'skills/rad-plan/SKILL.md', destinationPath: '${HARNESS_ROOT}/skills/rad-plan/SKILL.md' }],
    };

    const result = removeManifestFiles(manifest, 'claude');
    expect(result.removedCount).toBe(1);
    // The empty skill dir should be pruned
    expect(result.prunedDirs.length).toBeGreaterThan(0);
    expect(fs.existsSync(skillDir)).toBe(false);
  });

  it('does not prune non-empty parent directories', () => {
    const harnessRoot = path.join(fakeHome, '.claude');
    const agentsDir = path.join(harnessRoot, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });

    // Place two files; only remove one
    const file1 = path.join(agentsDir, 'planner.md');
    const file2 = path.join(agentsDir, 'coder.md');
    fs.writeFileSync(file1, 'planner', 'utf8');
    fs.writeFileSync(file2, 'coder', 'utf8');

    const manifest = {
      files: [{ bundlePath: 'agents/planner.md', destinationPath: '${HARNESS_ROOT}/agents/planner.md' }],
    };

    const result = removeManifestFiles(manifest, 'claude');
    expect(result.removedCount).toBe(1);
    // agents/ still has coder.md so should not be pruned
    expect(fs.existsSync(agentsDir)).toBe(true);
    expect(fs.existsSync(file2)).toBe(true);
  });

  it('ignores manifest entries whose files do not exist on disk', () => {
    const manifest = {
      files: [{ bundlePath: 'agents/nonexistent.md', destinationPath: '${HARNESS_ROOT}/agents/nonexistent.md' }],
    };

    const result = removeManifestFiles(manifest, 'claude');
    expect(result.removedCount).toBe(0);
  });

  it('never touches projects/ entries — hard guard (AD-7)', () => {
    // Create a project file under ~/.radorch/projects/
    const projectsDir = path.join(fakeHome, '.radorch', 'projects');
    const projectDir = path.join(projectsDir, 'my-project');
    fs.mkdirSync(projectDir, { recursive: true });

    const projectFile = path.join(projectDir, 'state.json');
    fs.writeFileSync(projectFile, '{"state":"important"}', 'utf8');
    expect(fs.existsSync(projectFile)).toBe(true);

    // Stray manifest entry that would route to projects/
    const manifest = {
      files: [{ bundlePath: 'projects/my-project/state.json', destinationPath: '${RAD_HOME}/projects/my-project/state.json' }],
    };

    const result = removeManifestFiles(manifest, 'claude');

    // File must be completely untouched
    expect(fs.existsSync(projectFile)).toBe(true);
    expect(result.removedCount).toBe(0);
  });

  it('processes multiple files and returns correct removedCount', () => {
    const harnessRoot = path.join(fakeHome, '.claude');
    const agentsDir = path.join(harnessRoot, 'agents');
    const skillDir = path.join(harnessRoot, 'skills', 'rad-plan');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.mkdirSync(skillDir, { recursive: true });

    fs.writeFileSync(path.join(agentsDir, 'planner.md'), 'planner', 'utf8');
    fs.writeFileSync(path.join(agentsDir, 'coder.md'), 'coder', 'utf8');
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), 'skill', 'utf8');

    const manifest = {
      files: [
        { bundlePath: 'agents/planner.md', destinationPath: '${HARNESS_ROOT}/agents/planner.md' },
        { bundlePath: 'agents/coder.md', destinationPath: '${HARNESS_ROOT}/agents/coder.md' },
        { bundlePath: 'skills/rad-plan/SKILL.md', destinationPath: '${HARNESS_ROOT}/skills/rad-plan/SKILL.md' },
      ],
    };

    const result = removeManifestFiles(manifest, 'claude');
    expect(result.removedCount).toBe(3);
    expect(fs.existsSync(path.join(agentsDir, 'planner.md'))).toBe(false);
    expect(fs.existsSync(path.join(agentsDir, 'coder.md'))).toBe(false);
    expect(fs.existsSync(path.join(skillDir, 'SKILL.md'))).toBe(false);
  });
});
