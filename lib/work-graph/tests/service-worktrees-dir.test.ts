import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { WorkGraphService } from '../src/service.js';

describe('WorkGraphService worktrees dir reconciliation (NFR-7)', () => {
  it('defaults worktreesDir to <root>/worktrees', () => {
    const svc = new WorkGraphService({ root: '/fake/.radorc' }) as unknown as { worktreesDir(): string };
    expect(svc.worktreesDir()).toBe(path.join('/fake/.radorc', 'worktrees'));
  });
  it('honors an explicit worktreesDir override from ServiceOpts (single-authority seam)', () => {
    const svc = new WorkGraphService({ root: '/fake/.radorc', worktreesDir: '/authoritative/worktrees' }) as unknown as { worktreesDir(): string };
    expect(svc.worktreesDir()).toBe('/authoritative/worktrees');
  });
  it('defaults sideProjectsDir to <root>/side-projects', () => {
    const svc = new WorkGraphService({ root: '/fake/.radorc' }) as unknown as { sideProjectsDir(): string };
    expect(svc.sideProjectsDir()).toBe(path.join('/fake/.radorc', 'side-projects'));
  });
  it('honors an explicit sideProjectsDir override from ServiceOpts', () => {
    const svc = new WorkGraphService({ root: '/fake/.radorc', sideProjectsDir: '/authoritative/side-projects' }) as unknown as { sideProjectsDir(): string };
    expect(svc.sideProjectsDir()).toBe('/authoritative/side-projects');
  });
});
