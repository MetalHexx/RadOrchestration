import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import os from 'node:os';
import { resolveBundleTarget } from '../../../src/lib/upgrade/route.js';

describe('resolveBundleTarget — path-prefix routing', () => {
  beforeEach(() => vi.spyOn(os, 'homedir').mockReturnValue('/fake/home'));

  it('routes agents/<file> to ~/.claude/agents for claude harness', () => {
    const r = resolveBundleTarget('agents/planner.md', 'claude');
    expect(r).toBe(path.join('/fake/home', '.claude', 'agents', 'planner.md'));
  });

  it('routes agents/<file> to ~/.copilot/agents for copilot-vscode', () => {
    const r = resolveBundleTarget('agents/planner.md', 'copilot-vscode');
    expect(r).toBe(path.join('/fake/home', '.copilot', 'agents', 'planner.md'));
  });

  it('routes skills/<name>/SKILL.md to harness skill folder', () => {
    const r = resolveBundleTarget('skills/rad-plan/SKILL.md', 'claude');
    expect(r).toBe(path.join('/fake/home', '.claude', 'skills', 'rad-plan', 'SKILL.md'));
  });

  it('routes templates/<file> under ~/.radorch/', () => {
    const r = resolveBundleTarget('templates/extra-high.yml', 'claude');
    expect(r).toBe(path.join('/fake/home', '.radorch', 'templates', 'extra-high.yml'));
  });

  it('routes orchestration.yml under ~/.radorch/', () => {
    const r = resolveBundleTarget('orchestration.yml', 'claude');
    expect(r).toBe(path.join('/fake/home', '.radorch', 'orchestration.yml'));
  });

  it('routes ui/server.js under ~/.radorch/ui/', () => {
    const r = resolveBundleTarget('ui/server.js', 'claude');
    expect(r).toBe(path.join('/fake/home', '.radorch', 'ui', 'server.js'));
  });

  it('throws on unknown harness', () => {
    expect(() => resolveBundleTarget('agents/x.md', 'unknown' as never)).toThrow();
  });
});
