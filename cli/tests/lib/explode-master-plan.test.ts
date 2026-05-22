import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { explodeMasterPlan, parseMasterPlan, ParseError } from '../../src/lib/explode-master-plan.js';

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
