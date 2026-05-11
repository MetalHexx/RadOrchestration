import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectModifiedFiles, confirmModifiedFiles, hexSha256OfBytes } from '../../../src/lib/upgrade/hash-check.js';

function sha256(content: string): string {
  return crypto.createHash('sha256').update(Buffer.from(content, 'utf8')).digest('hex');
}

describe('hexSha256OfBytes', () => {
  it('returns expected hex string', () => {
    const buf = Buffer.from('hello', 'utf8');
    expect(hexSha256OfBytes(buf)).toBe(sha256('hello'));
  });
});

describe('detectModifiedFiles', () => {
  let tmpDir: string;
  let fakeHome: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hash-check-test-'));
    fakeHome = tmpDir;
    vi.spyOn(os, 'homedir').mockReturnValue(fakeHome);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when all files match their manifest sha256', () => {
    // Build harness dir and place files
    const harnessRoot = path.join(fakeHome, '.claude');
    const agentsDir = path.join(harnessRoot, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });

    const content = 'agent content';
    fs.writeFileSync(path.join(agentsDir, 'planner.md'), content, 'utf8');

    const manifest = {
      files: [
        { bundlePath: 'agents/planner.md', sha256: sha256(content), ownership: 'managed' },
      ],
    };

    const result = detectModifiedFiles(manifest, 'claude');
    expect(result).toEqual([]);
  });

  it('returns modified bundlePaths when on-disk content differs from manifest sha256', () => {
    const harnessRoot = path.join(fakeHome, '.claude');
    const agentsDir = path.join(harnessRoot, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });

    const originalContent = 'original content';
    const modifiedContent = 'modified content';
    fs.writeFileSync(path.join(agentsDir, 'coder.md'), modifiedContent, 'utf8');

    const manifest = {
      files: [
        { bundlePath: 'agents/coder.md', sha256: sha256(originalContent), ownership: 'managed' },
      ],
    };

    const result = detectModifiedFiles(manifest, 'claude');
    expect(result).toEqual(['agents/coder.md']);
  });

  it('ignores files that do not exist on disk', () => {
    const manifest = {
      files: [
        { bundlePath: 'agents/missing.md', sha256: 'somesha', ownership: 'managed' },
      ],
    };

    const result = detectModifiedFiles(manifest, 'claude');
    expect(result).toEqual([]);
  });

  it('skips entries with ownership = user-config (verbatim rule from installer)', () => {
    const radOrchRoot = path.join(fakeHome, '.radorch');
    fs.mkdirSync(radOrchRoot, { recursive: true });

    const userContent = 'user modified orchestration';
    fs.writeFileSync(path.join(radOrchRoot, 'orchestration.yml'), userContent, 'utf8');

    const manifest = {
      files: [
        { bundlePath: 'orchestration.yml', sha256: sha256('bundled content'), ownership: 'user-config' },
      ],
    };

    // ownership: 'user-config' must be skipped even though hash differs
    const result = detectModifiedFiles(manifest, 'claude');
    expect(result).toEqual([]);
  });

  it('never enumerates entries whose resolved path falls under projects/ (AD-7)', () => {
    // Simulate a stray manifest entry pointing under projects/
    const projectsDir = path.join(fakeHome, '.radorch', 'projects');
    const strayDir = path.join(projectsDir, 'my-project');
    fs.mkdirSync(strayDir, { recursive: true });

    const content = 'project file';
    const strayFile = path.join(strayDir, 'state.json');
    fs.writeFileSync(strayFile, content, 'utf8');

    // The bundlePath here would route to ~/.radorch/projects/... via route.ts
    // We need to construct a bundlePath that routes there.
    // route.ts: paths not starting with agents/ or skills/ go to userDataPaths().root
    // So 'projects/my-project/state.json' routes to ~/.radorch/projects/my-project/state.json
    const manifest = {
      files: [
        {
          bundlePath: 'projects/my-project/state.json',
          sha256: sha256('different content'),
          ownership: 'managed',
        },
      ],
    };

    const result = detectModifiedFiles(manifest, 'claude');
    // projects/ entries must never be enumerated (AD-7)
    expect(result).toEqual([]);
  });

  it('returns results sorted alphabetically', () => {
    const harnessRoot = path.join(fakeHome, '.claude');
    const agentsDir = path.join(harnessRoot, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });

    const wrongHash = 'wronghash000';
    fs.writeFileSync(path.join(agentsDir, 'zzz.md'), 'z content', 'utf8');
    fs.writeFileSync(path.join(agentsDir, 'aaa.md'), 'a content', 'utf8');

    const manifest = {
      files: [
        { bundlePath: 'agents/zzz.md', sha256: wrongHash, ownership: 'managed' },
        { bundlePath: 'agents/aaa.md', sha256: wrongHash, ownership: 'managed' },
      ],
    };

    const result = detectModifiedFiles(manifest, 'claude');
    expect(result).toEqual(['agents/aaa.md', 'agents/zzz.md']);
  });

  it('handles mixed agents/ (harness-routed) and templates/ (root-routed) entries', () => {
    const harnessRoot = path.join(fakeHome, '.claude');
    const agentsDir = path.join(harnessRoot, 'agents');
    const radOrchRoot = path.join(fakeHome, '.radorch');
    const templatesDir = path.join(radOrchRoot, 'templates');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.mkdirSync(templatesDir, { recursive: true });

    const agentContent = 'agent content';
    const templateContent = 'template content';
    fs.writeFileSync(path.join(agentsDir, 'planner.md'), agentContent, 'utf8');
    fs.writeFileSync(path.join(templatesDir, 'high.yml'), 'MODIFIED template', 'utf8');

    const manifest = {
      files: [
        { bundlePath: 'agents/planner.md', sha256: sha256(agentContent), ownership: 'managed' },
        { bundlePath: 'templates/high.yml', sha256: sha256(templateContent), ownership: 'managed' },
      ],
    };

    const result = detectModifiedFiles(manifest, 'claude');
    // Only templates/high.yml is modified
    expect(result).toEqual(['templates/high.yml']);
  });
});

describe('confirmModifiedFiles', () => {
  it('calls the injected confirm with default: false and returns its result', async () => {
    const fakeConfirm = vi.fn().mockResolvedValue(true);
    const result = await confirmModifiedFiles(
      ['agents/planner.md'],
      '/fake/orch',
      fakeConfirm as never,
    );
    expect(result).toBe(true);
    expect(fakeConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ default: false }),
    );
  });

  it('returns false when user declines', async () => {
    const fakeConfirm = vi.fn().mockResolvedValue(false);
    const result = await confirmModifiedFiles(
      ['agents/coder.md'],
      '/fake/orch',
      fakeConfirm as never,
    );
    expect(result).toBe(false);
  });

  it('accepts a custom message via options', async () => {
    const fakeConfirm = vi.fn().mockResolvedValue(true);
    await confirmModifiedFiles(
      ['agents/planner.md'],
      '/fake/orch',
      fakeConfirm as never,
      { message: 'Overwrite anyway?' },
    );
    expect(fakeConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Overwrite anyway?' }),
    );
  });
});
