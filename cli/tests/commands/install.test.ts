import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runInstall } from '../../src/commands/install.js';

let tmp: string;
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-install-')); });
afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

function makeCtx(home: string) {
  return {
    env: { RADORCH_HOME: home, RADORCH_NO_LOG: '1' } as NodeJS.ProcessEnv,
    ux: { isTTY: false, nonInteractive: true, noColor: true, json: true },
  };
}

describe('radorch install', () => {
  it('errors with user_error when the install root already exists', async () => {
    const home = path.join(tmp, 'pre');
    await fs.mkdir(home, { recursive: true });
    await expect(
      runInstall({ defaultHarness: 'claude', ctx: makeCtx(home) }),
    ).rejects.toMatchObject({ type: 'user_error' });
  });

  it('writes the full skeleton (install.json, config.yml, registry.yml, .harness, .gitignore, dirs, harness bundles)', async () => {
    const home = path.join(tmp, 'rad');
    const result = await runInstall({ defaultHarness: 'copilot-vscode', ctx: makeCtx(home) });
    expect(result.root).toBe(home);
    expect(result.harnesses_installed).toEqual(['claude', 'copilot-vscode', 'copilot-cli']);
    expect(result.active_harness).toBe('copilot-vscode');

    // install.json
    const installJson = JSON.parse(await fs.readFile(path.join(home, 'install.json'), 'utf8'));
    expect(typeof installJson.package_version).toBe('string');
    expect(typeof installJson.installed_at).toBe('string');

    // config.yml
    const configText = await fs.readFile(path.join(home, 'config.yml'), 'utf8');
    expect(configText).toContain('default_active_harness: copilot-vscode');

    // registry.yml — empty skeleton
    const regText = await fs.readFile(path.join(home, 'registry.yml'), 'utf8');
    expect(regText).toContain('repos:');
    expect(regText).toContain('workspaces:');

    // .harness pointer
    expect((await fs.readFile(path.join(home, '.harness'), 'utf8')).trim()).toBe('copilot-vscode');

    // .gitignore present
    const gitignore = await fs.readFile(path.join(home, '.gitignore'), 'utf8');
    expect(gitignore.length).toBeGreaterThan(0);

    // empty dirs
    for (const dir of ['projects', 'worktrees', 'logs']) {
      const stat = await fs.stat(path.join(home, dir));
      expect(stat.isDirectory()).toBe(true);
    }

    // harness bundles
    for (const h of ['claude', 'copilot-vscode', 'copilot-cli']) {
      const stat = await fs.stat(path.join(home, 'runtime', 'harnesses', h));
      expect(stat.isDirectory()).toBe(true);
    }
  });
});
