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

describe('explosion derives phase repos as task union (FR-2, AD-2)', () => {
  it('unions task repos deterministically and ignores the decorative phase-body line', () => {
    const { projectDir, masterPlanPath } = makeProject();
    fs.writeFileSync(masterPlanPath,
      '---\nrepos: [backend, frontend, shared]\n---\n\n' +
      '## P01: First\n' +
      '**Target repos:** shared\n\n' +
      '### P01-T01: A\n**Requirements:** FR-1\n**Target repos:** backend, shared\n**Files for backend:**\n- Create: `a.ts`\n**Files for shared:**\n- Create: `b.ts`\n\n' +
      '### P01-T02: B\n**Requirements:** FR-1\n**Target repos:** frontend\n**Files for frontend:**\n- Create: `c.ts`\n', 'utf8');
    const result = explodeMasterPlan({
      projectDir, masterPlanPath, projectName: 'X', nowIso: '2026-05-22T00:00:00.000Z',
    });
    const raw = fs.readFileSync(result.emittedPhaseFiles[0]!, 'utf8');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]!;
    const parsed = parseYaml(fm) as Record<string, unknown>;
    expect(parsed.repos).toEqual(['backend', 'shared', 'frontend']);
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

describe('explosion enforces task repo shape (FR-4, FR-5, FR-6)', () => {
  const seal = '---\nrepos: [backend, frontend]\n---\n\n';
  function expectParseError(plan: string) {
    const { projectDir, masterPlanPath } = makeProject();
    fs.writeFileSync(masterPlanPath, plan, 'utf8');
    try {
      explodeMasterPlan({ projectDir, masterPlanPath, projectName: 'X', nowIso: '2026-05-22T00:00:00.000Z' });
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError);
      expect(Object.keys((err as ParseError).toDetail()).sort()).toEqual(['expected', 'found', 'line', 'message']);
      return;
    }
    throw new Error('expected ParseError');
  }
  it('fails on a missing Target repos line (FR-4)', () => {
    expectParseError(seal + '## P01: P\n\n### P01-T01: A\n**Requirements:** FR-1\nbody only\n');
  });
  it('fails on a present-but-empty Target repos line (FR-5)', () => {
    expectParseError(seal + '## P01: P\n\n### P01-T01: A\n**Requirements:** FR-1\n**Target repos:**\n**Files for backend:**\n- Create: `a.ts`\n');
  });
  it('fails on a repo outside the sealed repos (FR-6)', () => {
    expectParseError(seal + '## P01: P\n\n### P01-T01: A\n**Requirements:** FR-1\n**Target repos:** payments\n**Files for payments:**\n- Create: `a.ts`\n');
  });
});

describe('explosion repo-shape enforcement precision (FR-5, NFR-8)', () => {
  const seal = '---\nrepos: [backend, frontend]\n---\n\n';

  it('classifies a present-but-empty Target repos line as the FR-5 empty-line error', () => {
    const { projectDir, masterPlanPath } = makeProject();
    fs.writeFileSync(masterPlanPath,
      seal +
      '## P01: P\n\n' +
      '### P01-T01: A\n**Requirements:** FR-1\n**Target repos:**\n' +
      '**Files for backend:**\n- Create: `a.ts`\n', 'utf8');
    try {
      explodeMasterPlan({ projectDir, masterPlanPath, projectName: 'X', nowIso: '2026-05-22T00:00:00.000Z' });
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError);
      const detail = (err as ParseError).toDetail();
      expect(String(detail.message)).toMatch(/present-but-empty/i);
      expect(String(detail.found)).toMatch(/empty/i);
      return;
    }
    throw new Error('expected a ParseError for the present-but-empty Target repos line');
  });

  it('reports the offending task heading line in enforcement errors', () => {
    const { projectDir, masterPlanPath } = makeProject();
    const plan =
      seal +
      '## P01: P\n\n' +
      '### P01-T01: A\n**Requirements:** FR-1\n**Target repos:**\n' +
      '**Files for backend:**\n- Create: `a.ts`\n';
    fs.writeFileSync(masterPlanPath, plan, 'utf8');
    const expectedLine = plan.split('\n').findIndex(l => l.startsWith('### P01-T01:')) + 1;
    try {
      explodeMasterPlan({ projectDir, masterPlanPath, projectName: 'X', nowIso: '2026-05-22T00:00:00.000Z' });
    } catch (err) {
      expect((err as ParseError).toDetail().line).toBe(expectedLine);
      return;
    }
    throw new Error('expected a ParseError reporting the task heading line');
  });
});
