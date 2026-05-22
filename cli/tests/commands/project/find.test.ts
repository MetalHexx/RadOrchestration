import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectFind, projectFindCommand } from '../../../src/commands/project/find.js';
import { runCommand } from '../../../src/framework/command.js';

function makeProject(base: string, name: string, body: unknown) {
  const dir = path.join(base, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(body), 'utf8');
}

describe('projectFind core', () => {
  it('scans execution-tier projects, skipping _-prefixed folders, sorted', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-'));
    makeProject(base, '_TEMP', { pipeline: { current_tier: 'execution' } });
    makeProject(base, 'BBB', { pipeline: { current_tier: 'execution' }, planning: { steps: [{ name: 'master_plan', doc_path: '/m.md' }] } });
    makeProject(base, 'AAA', { pipeline: { current_tier: 'execution' } });
    makeProject(base, 'CCC', { pipeline: { current_tier: 'brainstorming' } });
    const exec = vi.fn(() => '');
    const r = projectFind({ projectsBasePath: base, repoRoot: '/r', exec });
    expect(r.projects.map((p) => p.name)).toEqual(['AAA', 'BBB']);
  });

  it('lookup-mode returns the project regardless of tier, single-element array on hit', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-'));
    makeProject(base, 'P', { pipeline: { current_tier: 'planning' } });
    const exec = vi.fn(() => '');
    const r = projectFind({ projectsBasePath: base, repoRoot: '/r', projectName: 'P', exec });
    expect(r.projects).toHaveLength(1);
    expect(r.projects[0]!.currentTier).toBe('planning');
  });

  it('lookup-mode returns empty array when project not found', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-'));
    const exec = vi.fn(() => '');
    expect(projectFind({ projectsBasePath: base, repoRoot: '/r', projectName: 'NOPE', exec }).projects).toEqual([]);
  });
});

describe('projectFind CLI path (runCommand argv → handler args)', () => {
  // Locks the framework contract: every kebab-case arg declared on
  // projectFindCommand must arrive at the handler under its declared hyphenated
  // key. Before the framework fix, --projects-base-path / --repo-root were
  // parsed by Commander into camelCase opts() and the args branch's
  // parsed[name] lookup returned undefined, surfacing as
  // "Missing required argument --projects-base-path".
  it('passes --projects-base-path, --repo-root, and --project-name through runCommand', async () => {
    type FindArgs = { 'projects-base-path'?: string; 'repo-root'?: string; 'project-name'?: string };
    let received: FindArgs = {};
    const probeDef = {
      ...projectFindCommand,
      handler: async ({ args }: { args: FindArgs; ctx: unknown }) => {
        received = args;
        return { probed: true } as never;
      },
      mapResult: undefined,
    };
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined as never) as never);
    await runCommand(probeDef, {
      argv: [
        '--projects-base-path', '/home/u/.radorch/projects',
        '--repo-root', '/repo',
        '--project-name', 'MYPROJ',
      ],
      env: { RADORCH_NO_LOG: '1' },
      isTTY: false,
      stderr: process.stderr,
    });
    expect(received['projects-base-path']).toBe('/home/u/.radorch/projects');
    expect(received['repo-root']).toBe('/repo');
    expect(received['project-name']).toBe('MYPROJ');
    const arg = (log.mock.calls[0]?.[0] ?? '') as string;
    const env = JSON.parse(arg);
    expect(env.ok).toBe(true);
    expect(exit).toHaveBeenCalledWith(0);
    log.mockRestore(); exit.mockRestore();
  });

  it('returns a well-formed user_error envelope when a required kebab arg is omitted in non-interactive mode', async () => {
    // Direct regression guard against the original symptom: with the bug,
    // every supplied kebab arg was treated as missing.
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined as never) as never);
    await runCommand(projectFindCommand, {
      argv: ['--non-interactive', '--repo-root', '/repo'],
      env: { RADORCH_NO_LOG: '1' },
      isTTY: true,
      stderr: process.stderr,
    });
    const arg = (log.mock.calls[0]?.[0] ?? '') as string;
    const env = JSON.parse(arg);
    expect(env.ok).toBe(false);
    expect(env.error.type).toBe('user_error');
    expect(env.error.message).toMatch(/projects-base-path/);
    expect(exit).toHaveBeenCalledWith(1);
    log.mockRestore(); exit.mockRestore();
  });
});
