import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { explodeMasterPlan, ParseError } from '../../src/lib/explode-master-plan.js';
import { parseYaml } from '../../src/lib/yaml.js';

function makeProject(): { projectDir: string; masterPlanPath: string } {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-'));
  const masterPlanPath = path.join(projectDir, 'MP.md');
  return { projectDir, masterPlanPath };
}

describe('explodeMasterPlan core', () => {
  it('parses a minimal plan and emits per-phase + per-task files', () => {
    const { projectDir, masterPlanPath } = makeProject();
    fs.writeFileSync(masterPlanPath,
      '## P01: First\nphase body\n\n### P01-T01: T One\n**Requirements:** FR-1\nt body\n', 'utf8');
    const result = explodeMasterPlan({
      projectDir, masterPlanPath, projectName: 'X',
      nowIso: '2026-05-22T00:00:00.000Z',
    });
    expect(result.emittedPhaseFiles).toHaveLength(1);
    expect(result.emittedTaskFiles).toHaveLength(1);
    expect(result.backupDir).toBeNull();
    expect(fs.existsSync(path.join(projectDir, 'phases'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'tasks'))).toBe(true);
  });

  it('throws ParseError with byte-identical toDetail() shape on malformed plan', () => {
    const { projectDir, masterPlanPath } = makeProject();
    fs.writeFileSync(masterPlanPath, '### P01-T01: Orphan task before any phase\n', 'utf8');
    try { explodeMasterPlan({ projectDir, masterPlanPath, projectName: 'X', nowIso: '2026-05-22T00:00:00.000Z' }); }
    catch (err) {
      expect(err).toBeInstanceOf(ParseError);
      const d = (err as ParseError).toDetail();
      expect(Object.keys(d).sort()).toEqual(['expected', 'found', 'line', 'message']);
      expect(typeof d.line).toBe('number');
      expect(typeof d.expected).toBe('string');
      expect(typeof d.found).toBe('string');
      expect(typeof d.message).toBe('string');
      return;
    }
    throw new Error('expected ParseError');
  });

  it('backs up populated phases/ on rerun', () => {
    const { projectDir, masterPlanPath } = makeProject();
    fs.writeFileSync(masterPlanPath,
      '## P01: A\n\n### P01-T01: T\nb\n', 'utf8');
    explodeMasterPlan({ projectDir, masterPlanPath, projectName: 'X', nowIso: '2026-05-22T00:00:00.000Z' });
    const second = explodeMasterPlan({ projectDir, masterPlanPath, projectName: 'X', nowIso: '2026-05-22T01:00:00.000Z' });
    expect(second.backupDir).not.toBeNull();
    expect(fs.existsSync(second.backupDir!)).toBe(true);
  });
});

describe('explosion lifts task target repos (FR-1, FR-3)', () => {
  it('emits a deterministic deduped repos: frontmatter field and leaves Files-for-repo as body text', () => {
    const { projectDir, masterPlanPath } = makeProject();
    fs.writeFileSync(masterPlanPath,
      '---\n' +
      'repos: [backend, frontend]\n' +
      '---\n\n' +
      '## P01: First\n\n' +
      '### P01-T01: T One\n' +
      '**Requirements:** FR-1\n' +
      '**Target repos:** frontend, backend, frontend\n' +
      '**Files for backend:**\n' +
      '- Create: `src/api/x.ts`\n' +
      '**Files for frontend:**\n' +
      '- Modify: `app/y.ts`\n', 'utf8');
    const result = explodeMasterPlan({
      projectDir, masterPlanPath, projectName: 'X',
      nowIso: '2026-05-22T00:00:00.000Z',
    });
    const raw = fs.readFileSync(result.emittedTaskFiles[0]!, 'utf8');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]!;
    const parsed = parseYaml(fm) as Record<string, unknown>;
    expect(parsed.repos).toEqual(['frontend', 'backend']);
    expect(raw).toContain('**Files for backend:**');
    expect(raw).toContain('- Modify: `app/y.ts`');
  });
});
