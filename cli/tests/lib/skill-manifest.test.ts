import { describe, it, expect, vi, beforeAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSkillManifest, buildSkillManifestPerRepo } from '../../src/lib/skill-manifest.js';

// ---------------------------------------------------------------------------
// Shared fixture setup for buildSkillManifestPerRepo tests
// ---------------------------------------------------------------------------
const fixtureRoots: Record<string, string> = {};

function fixtureRoot(name: string): string {
  return fixtureRoots[name]!;
}

beforeAll(() => {
  // api-with-skill: has one non-rad- SKILL.md for "deploy-helper"
  const apiRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-per-repo-api-'));
  const skillDir = path.join(apiRoot, 'skills', 'deploy-helper');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: deploy-helper\ndescription: Deploy helper\n---\n',
    'utf8',
  );
  fixtureRoots['api-with-skill'] = apiRoot;

  // ui-no-skill: empty directory — no SKILL.md
  const uiRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-per-repo-ui-'));
  fixtureRoots['ui-no-skill'] = uiRoot;
});

function writeSkill(dir: string, name: string, body: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), body, 'utf8');
}

describe('buildSkillManifest', () => {
  it('returns an empty array when repoRoot has no SKILL.md files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-'));
    expect(buildSkillManifest({ repoRoot: root })).toEqual([]);
  });

  it('sorts by name locale-ascending, filters rad-* and disable-model-invocation:true', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-'));
    writeSkill(path.join(root, 'skills/bbb'), 'bbb', '---\nname: bbb\ndescription: b skill\n---\n');
    writeSkill(path.join(root, 'skills/aaa'), 'aaa', '---\nname: aaa\ndescription: a skill\n---\n');
    writeSkill(path.join(root, 'skills/rad-x'), 'rad-x', '---\nname: rad-x\ndescription: filtered\n---\n');
    writeSkill(path.join(root, 'skills/dmi'), 'dmi', '---\nname: dmi\ndescription: filtered\ndisable-model-invocation: true\n---\n');
    const out = buildSkillManifest({ repoRoot: root });
    expect(out.map(e => e.name)).toEqual(['aaa', 'bbb']);
    expect(path.isAbsolute(out[0]!.path)).toBe(true);
  });

  it('keeps disable-model-invocation: "true" (string) — only boolean true filters', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-'));
    writeSkill(path.join(root, 'skills/keep'), 'keep', '---\nname: keep\ndescription: ok\ndisable-model-invocation: "true"\n---\n');
    expect(buildSkillManifest({ repoRoot: root }).map(e => e.name)).toEqual(['keep']);
  });

  it('skips entries with missing name or missing description, warning to stderr', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-'));
    writeSkill(path.join(root, 'skills/noname'), 'noname', '---\ndescription: only\n---\n');
    writeSkill(path.join(root, 'skills/nodesc'), 'nodesc', '---\nname: only\n---\n');
    const warn = vi.fn();
    const out = buildSkillManifest({ repoRoot: root, warn });
    expect(out).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('skips entries with malformed frontmatter, warning to stderr', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-'));
    writeSkill(path.join(root, 'skills/bad'), 'bad', '---\nname: bad\nthis is not yaml\n---\n');
    const warn = vi.fn();
    const out = buildSkillManifest({ repoRoot: root, warn });
    expect(out).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('walks deep paths and ignores EXCLUDED_DIRS', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-'));
    writeSkill(path.join(root, 'packages/a/b/c/d/skill'), 'deep', '---\nname: deep\ndescription: nested\n---\n');
    writeSkill(path.join(root, 'node_modules/pkg/skills/x'), 'x', '---\nname: x\ndescription: hidden\n---\n');
    writeSkill(path.join(root, 'prompt-tests/y/skills/y'), 'y', '---\nname: y\ndescription: hidden\n---\n');
    writeSkill(path.join(root, '.git/skills/z'), 'z', '---\nname: z\ndescription: hidden\n---\n');
    expect(buildSkillManifest({ repoRoot: root }).map(e => e.name)).toEqual(['deep']);
  });
});

describe('buildSkillManifestPerRepo — repo-tagged (FR-18)', () => {
  it('tags each discovered skill with its repo name', () => {
    const out = buildSkillManifestPerRepo({
      repos: [
        { name: 'fake-api', root: fixtureRoot('api-with-skill') },
        { name: 'fake-ui', root: fixtureRoot('ui-no-skill') },
      ],
    });
    expect(out).toEqual([
      { name: 'deploy-helper', description: 'Deploy helper', path: expect.any(String), repo: 'fake-api' },
    ]);
  });
});
